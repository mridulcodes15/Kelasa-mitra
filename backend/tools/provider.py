"""
LLM provider module — Groq (free-tier).

Uses the `groq` Python SDK when GROQ_API_KEY is set.
Falls back to the rule-based extractor automatically when:
  - GROQ_API_KEY is absent / empty
  - the LLM call fails for any reason (network, rate-limit, parse error)

Chosen model: llama-3.3-70b-versatile
  Rationale: largest free-tier model on Groq with the strongest Indic
  (Kannada / Hindi / Devanagari) language coverage as of late 2026.

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
import re
from pathlib import Path
from typing import Any

from .fallback import extract_profile_fallback

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
  skills           – list of skill IDs from the provided taxonomy (use exact IDs)
  experience_years – number (float) or null
  area             – object with keys id, name, lat, lon  OR null
  languages        – list of languages spoken (e.g. ["kannada","hindi"])

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


def _parse_llm_json(raw: str) -> dict[str, Any] | None:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    return None


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
        logger.warning("Groq call failed (%s); using rule-based fallback.", exc)
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
            parsed = _parse_llm_json(raw)
            if parsed is not None:
                skills_data, _ = _load_reference_data()
                valid_ids = {s["id"] for s in skills_data}
                parsed["skills"] = [s for s in (parsed.get("skills") or []) if s in valid_ids]
                logger.info("Groq extraction succeeded (model=%s, cached=%s).",
                            model, _cached_llm_call.cache_info().hits > 0)
                return parsed
        logger.warning("Groq returned unparseable JSON; using rule-based fallback.")
    else:
        if not api_key:
            logger.debug("GROQ_API_KEY not set; using rule-based fallback.")

    return extract_profile_fallback(text, detected_language)
