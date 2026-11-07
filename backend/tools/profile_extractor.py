"""
extract_profile tool.

Language resolution order:
  1. ui_language passed by the frontend picker (most reliable)
  2. langdetect on the input text (fallback)
  3. "en" (default)

Exported:
    extract_profile(text, ui_language=None) -> WorkerProfile
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from langdetect import detect, LangDetectException

from models.worker import WorkerProfile, AreaLocation
from tools.provider import call_llm

logger = logging.getLogger(__name__)

_KNOWN_CODES = {"kn", "hi", "en", "ta", "te", "ml", "mr"}


def _detect_language(text: str) -> str:
    """Return langdetect language code. Defaults to 'en' on failure."""
    try:
        code = detect(text)
        return code if code in _KNOWN_CODES else code
    except LangDetectException:
        return "en"


def _resolve_language(text: str, ui_language: Optional[str]) -> str:
    """
    Use the frontend picker language when provided; otherwise use langdetect.
    The ui_language is stripped and lowercased; unknown values fall through to
    langdetect so a malformed request doesn't break extraction.
    """
    if ui_language:
        cleaned = ui_language.strip().lower()
        if cleaned in _KNOWN_CODES:
            return cleaned
    return _detect_language(text)


def _build_area_location(area_dict: dict[str, Any] | None) -> AreaLocation | None:
    if area_dict is None:
        return None
    return AreaLocation(
        id=area_dict["id"],
        name=area_dict["name"],
        lat=area_dict["lat"],
        lon=area_dict["lon"],
    )


def extract_profile(text: str, ui_language: Optional[str] = None) -> WorkerProfile:
    """
    Extract a structured WorkerProfile from free-form worker text.

    Args:
        text:        Worker's description in Kannada, Hindi, English, or a mix.
        ui_language: Language code selected on the frontend picker ("kn"/"hi"/"en").
                     Used as the primary detected_language; langdetect is the fallback.

    Returns:
        WorkerProfile with skills, experience_years, area, languages, detected_language.
    """
    detected_language = _resolve_language(text, ui_language)
    raw: dict[str, Any] = call_llm(text, detected_language)

    return WorkerProfile(
        skills=raw.get("skills") or [],
        experience_years=raw.get("experience_years"),
        area=_build_area_location(raw.get("area")),
        languages=raw.get("languages") or [],
        detected_language=detected_language,
        raw_input=text,
    )
