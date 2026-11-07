#!/usr/bin/env python3
"""
scripts/compare_providers.py
─────────────────────────────
Runs all 13 samples through both the Groq LLM provider and the rule-based
fallback, then prints a comparison table.

Usage:
    cd backend
    python scripts/compare_providers.py

Requires: GROQ_API_KEY set in backend/.env (or in the environment).
If the key is missing, the Groq column will show "FALLBACK" for all rows.

Groq model considered:
  ✓ llama-3.3-70b-versatile  – chosen (largest free model, best Indic support)
  ✗ llama-3.1-8b-instant     – faster but weaker Kannada/Hindi
  ✗ mixtral-8x7b-32768       – older, weaker Indic script
  ✗ gemma2-9b-it             – weak Kannada coverage
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure backend/ is on path
BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv
load_dotenv(BACKEND / ".env")

from tools.fallback import extract_profile_fallback
from tools.profile_extractor import _detect_language


def _run_groq(text: str, lang: str) -> dict:
    """Call Groq (if key set) and return dict. On any failure returns fallback result."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

    if not api_key:
        return {"_source": "FALLBACK (no key)", **extract_profile_fallback(text, lang)}

    try:
        from groq import Groq  # type: ignore
        from tools.provider import (
            _build_prompt, _parse_llm_json, _load_reference_data, _validate_llm_output,
        )

        skills_data, areas_data = _load_reference_data()
        skill_ids = [s["id"] for s in skills_data]
        prompt = _build_prompt(text, skill_ids, areas_data)

        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=512,
        )
        raw = completion.choices[0].message.content
        try:
            result = _validate_llm_output(
                _parse_llm_json(raw), text, lang, {s["id"] for s in skills_data},
            )
        except (KeyError, TypeError, ValueError, AttributeError):
            return {"_source": "FALLBACK (malformed output)", **extract_profile_fallback(text, lang)}
        result["_source"] = f"GROQ/{model}"
        return result
    except Exception as exc:
        # Exception type only: provider error text can echo request details.
        return {"_source": f"FALLBACK ({type(exc).__name__})", **extract_profile_fallback(text, lang)}


def _fmt_skills(skills: list[str]) -> str:
    return ", ".join(skills) if skills else "—"


def main() -> None:
    samples_path = BACKEND / "tests" / "samples.json"
    with open(samples_path, encoding="utf-8") as f:
        samples = json.load(f)

    COL = {
        "id": 4, "desc": 42, "ui_lang": 4,
        "fb_skills": 30, "groq_skills": 30, "mismatch": 8,
    }
    header = (
        f"{'ID':<{COL['id']}} "
        f"{'Description':<{COL['desc']}} "
        f"{'Lang':<{COL['ui_lang']}} "
        f"{'Fallback skills':<{COL['fb_skills']}} "
        f"{'Groq skills':<{COL['groq_skills']}} "
        f"{'Match?':<{COL['mismatch']}}"
    )
    sep = "─" * len(header)
    print(sep)
    print(header)
    print(sep)

    mismatches = 0
    for s in samples:
        text = s["input"]
        lang = s.get("ui_language", "en")

        fb = extract_profile_fallback(text, lang)
        gr = _run_groq(text, lang)

        fb_skills = sorted(fb.get("skills") or [])
        gr_skills = sorted(gr.get("skills") or [])

        match = "✓" if fb_skills == gr_skills else "✗ MISS"
        if match != "✓":
            mismatches += 1

        desc = s["description"][:COL["desc"]]
        print(
            f"{s['id']:<{COL['id']}} "
            f"{desc:<{COL['desc']}} "
            f"{lang:<{COL['ui_lang']}} "
            f"{_fmt_skills(fb_skills):<{COL['fb_skills']}} "
            f"{_fmt_skills(gr_skills):<{COL['groq_skills']}} "
            f"{match:<{COL['mismatch']}}"
        )

    print(sep)
    groq_source = _run_groq("test", "en").get("_source", "?")
    print(f"Groq source : {groq_source}")
    print(f"Mismatches  : {mismatches} / {len(samples)}")
    print(sep)


if __name__ == "__main__":
    main()
