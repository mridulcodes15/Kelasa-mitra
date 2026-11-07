"""
Rule-based offline fallback for profile extraction.

Matches synonyms from skills.json (all three language lists),
detects Bengaluru areas, parses experience numbers, and infers
spoken languages — all without any network or LLM call.

Inflection handling
-------------------
Kannada and Hindi are agglutinative: a skill word like "ಡ್ರೈವರ್" appears in
text as "ಡ್ರೈವರ್ ಆಗಿದ್ದೆ" or "ಡ್ರೈವರ್ ಇದ್ದೇನೆ". We handle this by building a
stem map: for each Kannada/Hindi synonym we strip common postpositional and
tense suffixes, then check whether the stem appears anywhere in the input.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_DATA = Path(__file__).parent.parent / "data"

# ── load reference data once at import time ─────────────────────────────────

with open(_DATA / "skills.json", encoding="utf-8") as f:
    _SKILLS: list[dict[str, Any]] = json.load(f)

with open(_DATA / "areas.json", encoding="utf-8") as f:
    _AREAS: list[dict[str, Any]] = json.load(f)

# ── inflection suffix tables ─────────────────────────────────────────────────

# Kannada common postpositional / copula / verbal suffixes
# These follow the skill noun directly (with an optional space)
_KN_SUFFIXES: list[str] = [
    " ಆಗಿದ್ದೆ",   # was (past 1sg)
    " ಆಗಿದ್ದೇನೆ",  # was (present perfect 1sg)
    " ಆಗಿದ್ದಾರೆ",  # were (3pl honorific)
    " ಆಗಿ",       # as / having been (adverbial)
    " ಇದ್ದೇನೆ",   # am / was (1sg)
    " ಇದ್ದೆ",     # was (past 1sg)
    " ಇದ್ದಾರೆ",   # are (3pl)
    " ಅನ್ನು",     # accusative marker
    " ಕೆಲಸ",      # "work" — e.g. "ಡ್ರೈವರ್ ಕೆಲಸ"
    "ನ",          # genitive -na
]

# Hindi common verb / participle suffixes that follow a skill noun
_HI_SUFFIXES: list[str] = [
    " करती हूँ",  # do (fem. present)
    " करता हूँ",  # do (masc. present)
    " करती थी",  # did (fem. past)
    " करता था",  # did (masc. past)
    " कर रही हूँ",  # am doing (fem.)
    " कर रहा हूँ",  # am doing (masc.)
    " का काम",    # "the work of"
    " काम",       # "work"
]


def _stems_for(synonym: str, is_kn: bool, is_hi: bool) -> list[str]:
    """Return synonym itself plus any stems obtained by stripping known suffixes."""
    stems = [synonym]
    suffixes = []
    if is_kn:
        suffixes = _KN_SUFFIXES
    elif is_hi:
        suffixes = _HI_SUFFIXES
    for suf in suffixes:
        if synonym.endswith(suf):
            stem = synonym[: -len(suf)].strip()
            if stem and stem not in stems:
                stems.append(stem)
    return stems


# build a flat (lowercase synonym → skill_id) mapping
# also store (lowercase stem → skill_id) for inflection matching
_SKILL_MAP: dict[str, str] = {}
_STEM_MAP: dict[str, str] = {}

for skill in _SKILLS:
    for idx, syn_list in enumerate((skill["synonyms_en"], skill["synonyms_kn"], skill["synonyms_hi"])):
        is_kn = idx == 1
        is_hi = idx == 2
        for syn in syn_list:
            key = syn.lower().strip()
            _SKILL_MAP[key] = skill["id"]
            for stem in _stems_for(key, is_kn=is_kn, is_hi=is_hi):
                _STEM_MAP[stem] = skill["id"]

# build a flat (lowercase alias → area dict) mapping
_AREA_MAP: dict[str, dict[str, Any]] = {}
for area in _AREAS:
    for alias in area["aliases"]:
        _AREA_MAP[alias.lower().strip()] = area


# ── number parsing ───────────────────────────────────────────────────────────

_WORD_NUMBERS: dict[str, float] = {
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "half": 0.5,
    # Kannada
    "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5,
    "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
    # Hindi
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5,
    "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
}

_EXP_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:साल|year|years|ವರ್ಷ|yrs|yr)\b",
    re.IGNORECASE | re.UNICODE,
)


def _parse_experience(text: str) -> float | None:
    """Return the first numeric experience value found, or None."""
    # try numeric pattern first
    m = _EXP_PATTERN.search(text)
    if m:
        return float(m.group(1))
    # try word numbers preceding experience keywords
    lower = text.lower()
    for word, val in _WORD_NUMBERS.items():
        if word.lower() in lower:
            # check it's near an experience keyword
            pat = re.compile(
                rf"{re.escape(word.lower())}\s*(?:\w+\s*){{0,3}}(?:साल|year|years|ವರ್ಷ|yrs|yr)\b",
                re.IGNORECASE | re.UNICODE,
            )
            if pat.search(lower):
                return val
    return None


# ── language detection ───────────────────────────────────────────────────────

def _detect_languages_spoken(text: str) -> list[str]:
    """Heuristic: look for explicit language mentions."""
    langs: list[str] = []
    lower = text.lower()
    if any(k in lower for k in ["kannada", "ಕನ್ನಡ", "kannad"]):
        langs.append("kannada")
    if any(k in lower for k in ["hindi", "हिंदी", "हिन्दी"]):
        langs.append("hindi")
    if any(k in lower for k in ["english", "ಇಂಗ್ಲಿಷ್"]):
        langs.append("english")
    if any(k in lower for k in ["tamil", "தமிழ்"]):
        langs.append("tamil")
    if any(k in lower for k in ["telugu", "తెలుగు"]):
        langs.append("telugu")
    if any(k in lower for k in ["malayalam", "മലയാളം"]):
        langs.append("malayalam")
    if any(k in lower for k in ["marathi", "मराठी"]):
        langs.append("marathi")
    return langs


# ── main extraction ───────────────────────────────────────────────────────────

def extract_profile_fallback(text: str, detected_language: str) -> dict[str, Any]:
    """
    Rule-based profile extraction.

    Returns a dict matching the WorkerProfile schema (without raw_input /
    detected_language — those are added by the caller).
    """
    lower = text.lower()

    # ── skills ────────────────────────────────────────────────────────────────
    found_skills: list[str] = []
    # Pass 1: exact synonym match (longest first avoids substring shadowing)
    for synonym in sorted(_SKILL_MAP.keys(), key=len, reverse=True):
        if synonym in lower and _SKILL_MAP[synonym] not in found_skills:
            found_skills.append(_SKILL_MAP[synonym])
    # Pass 2: stem match for inflected Kannada / Hindi forms
    for stem in sorted(_STEM_MAP.keys(), key=len, reverse=True):
        skill_id = _STEM_MAP[stem]
        if skill_id not in found_skills and stem in lower:
            found_skills.append(skill_id)

    # ── area ──────────────────────────────────────────────────────────────────
    matched_area: dict[str, Any] | None = None
    for alias in sorted(_AREA_MAP.keys(), key=len, reverse=True):
        if alias in lower:
            matched_area = _AREA_MAP[alias]
            break

    # ── experience ────────────────────────────────────────────────────────────
    experience_years = _parse_experience(text)

    # ── languages spoken ──────────────────────────────────────────────────────
    spoken = _detect_languages_spoken(text)
    # infer from script if no explicit mention
    if not spoken:
        # Kannada script characters
        if any("\u0C80" <= ch <= "\u0CFF" for ch in text):
            spoken.append("kannada")
        # Devanagari (Hindi)
        if any("\u0900" <= ch <= "\u097F" for ch in text):
            spoken.append("hindi")

    result: dict[str, Any] = {
        "skills": found_skills,
        "experience_years": experience_years,
        "area": (
            {
                "id": matched_area["id"],
                "name": matched_area["name"],
                "lat": matched_area["lat"],
                "lon": matched_area["lon"],
            }
            if matched_area
            else None
        ),
        "languages": spoken,
    }
    return result
