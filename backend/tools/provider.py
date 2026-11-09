"""
LLM provider module — Groq (free-tier).

Uses the `groq` Python SDK when GROQ_API_KEY is set.
Falls back to the rule-based extractor automatically when:
  - GROQ_API_KEY is absent / empty
  - the LLM call fails for any reason (network, rate-limit, parse error)

Chosen model: llama-3.3-70b-versatile
  Rationale: largest free-tier model on Groq with the strongest Indic
  (Kannada / Hindi / Devanagari) language coverage as of late 2026.

The LLM never supplies numbers. It may return only skill IDs, an area name and
spoken languages. Coordinates are looked up in areas.json and experience_years
is parsed from the worker's text by the rule-based code. Any malformed output
falls back to the rule-based extractor.

Response cache: LRU keyed by (text.strip(), detected_language) so repeated
identical inputs (e.g. re-submitting the same profile) never count against
the free-tier rate limit.

Public surface:
    call_llm(text, detected_language) -> dict   (WorkerProfile-shaped dict)
"""
from __future__ import annotations

import functools
import json
import logging
import os
from pathlib import Path
from typing import Any

from .fallback import extract_profile_fallback, lookup_area

logger = logging.getLogger(__name__)

_GROQ_AVAILABLE = False
try:
    from groq import Groq  # type: ignore
    _GROQ_AVAILABLE = True
except ImportError:
    logger.warning("groq SDK not installed; using rule-based fallback only.")

# ── Prompt template ──────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a multilingual profile-extraction assistant for a blue-collar job app in Bengaluru.
Extract information from the worker's input (which may be in Kannada, Hindi, English, or a mix).

Return ONLY a valid JSON object with these keys:
  skills    – list of skill IDs from the provided taxonomy (use exact IDs)
  area      – the area's name from the lookup below as a string, or null
  languages – list of languages spoken (e.g. ["kannada","hindi"])

Do not output any numbers, coordinates or years of experience.

Skill taxonomy IDs (use ONLY these):
{skill_ids}

Bengaluru area lookup (use ONLY these):
{area_lookup}

Worker input:
{text}

Respond with ONLY the JSON object, no markdown fences, no explanation."""


def _build_prompt(text: str, skill_ids: list[str], area_lookup: list[dict[str, Any]]) -> str:
    area_simple = [{"id": a["id"], "name": a["name"], "aliases": a["aliases"]} for a in area_lookup]
    return _SYSTEM_PROMPT.format(
        skill_ids=json.dumps(skill_ids),
        area_lookup=json.dumps(area_simple, ensure_ascii=False),
        text=text,
    )


def _strip_code_fence(raw: str) -> str:
    """Remove a Markdown code fence (``` or ```json) around the model's JSON, if any."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.removeprefix("```").removeprefix("json")
    return text.removesuffix("```").strip()


def _parse_llm_json(raw: str) -> dict[str, Any] | None:
    """The model's JSON object, or None when the output is not a JSON object."""
    try:
        data = json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError:
        return None  # malformed output: the caller falls back to the rules
    return data if isinstance(data, dict) else None


def _validate_llm_output(parsed: Any, text: str, detected_language: str,
                         valid_skill_ids: set[str]) -> dict[str, Any]:
    """
    Turn raw LLM JSON into a WorkerProfile-shaped dict, or raise on malformed output.

    Numbers are never taken from the LLM: extra keys such as experience_years or
    lat/lon are ignored, and an area given as anything but a name is rejected.
    """
    if not isinstance(parsed, dict):
        raise ValueError("LLM output is not an object")

    skills = parsed.get("skills") or []
    if not isinstance(skills, list) or not all(isinstance(s, str) for s in skills):
        raise ValueError("skills is not a list of strings")

    languages = parsed.get("languages") or []
    if not isinstance(languages, list) or not all(isinstance(l, str) for l in languages):
        raise ValueError("languages is not a list of strings")

    area_name = parsed.get("area")
    if area_name is not None and not isinstance(area_name, str):
        raise ValueError("area is not a name")

    rules = extract_profile_fallback(text, detected_language)
    return {
        "skills": [s for s in skills if s in valid_skill_ids],
        "experience_years": rules["experience_years"],
        "area": (lookup_area(area_name) if area_name else None) or rules["area"],
        "languages": [l.strip().lower() for l in languages if l.strip()],
    }


def _load_reference_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    data_dir = Path(__file__).parent.parent / "data"
    with open(data_dir / "skills.json", encoding="utf-8") as f:
        skills_data: list[dict[str, Any]] = json.load(f)
    with open(data_dir / "areas.json", encoding="utf-8") as f:
        areas_data: list[dict[str, Any]] = json.load(f)
    return skills_data, areas_data


# ── LRU response cache (max 128 entries) ────────────────────────────────────

@functools.lru_cache(maxsize=128)
def _cached_llm_call(text: str, detected_language: str, api_key: str, model: str) -> str | None:
    """
    Make the actual Groq API call.  Cached so identical (text, lang) pairs
    never hit the network twice.  Returns raw LLM string or None on failure.
    """
    try:
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
        return completion.choices[0].message.content
    except Exception as exc:
        # Exception type only: provider error text can echo request details.
        logger.warning("Groq call failed (%s); using rule-based fallback.", type(exc).__name__)
        return None


def call_llm(text: str, detected_language: str) -> dict[str, Any]:
    """
    Try Groq first; fall back to rule-based extraction on any failure.
    Returns a WorkerProfile-shaped dict (without raw_input / detected_language).
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

    if _GROQ_AVAILABLE and api_key:
        raw = _cached_llm_call(text.strip(), detected_language, api_key, model)
        if raw is not None:
            try:
                skills_data, _ = _load_reference_data()
                result = _validate_llm_output(
                    _parse_llm_json(raw), text, detected_language, {s["id"] for s in skills_data},
                )
                logger.info("Groq extraction succeeded (model=%s).", model)
                return result
            except (KeyError, TypeError, ValueError, AttributeError) as exc:
                logger.warning("Groq output rejected (%s); using rule-based fallback.", exc)
    else:
        if not api_key:
            logger.debug("GROQ_API_KEY not set; using rule-based fallback.")

    return extract_profile_fallback(text, detected_language)
