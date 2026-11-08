"""
Turn a raw extraction dict into a WorkerProfile.

No langdetect, LLM or FastAPI imports: shared by tools/profile_extractor.py and the
watsonx Orchestrate tools package (see orchestrate/build_kelasa_tools.py).
"""
from __future__ import annotations

from typing import Any

from models.worker import AreaLocation, WorkerProfile


def _build_area_location(area_dict: dict[str, Any] | None) -> AreaLocation | None:
    if area_dict is None:
        return None
    return AreaLocation(
        id=area_dict["id"],
        name=area_dict["name"],
        lat=area_dict["lat"],
        lon=area_dict["lon"],
    )


def build_profile(raw: dict[str, Any], text: str, detected_language: str) -> WorkerProfile:
    """Build the profile from an extraction result (rule-based or validated LLM output)."""
    return WorkerProfile(
        skills=raw.get("skills") or [],
        experience_years=raw.get("experience_years"),
        area=_build_area_location(raw.get("area")),
        languages=raw.get("languages") or [],
        detected_language=detected_language,
        raw_input=text,
    )
