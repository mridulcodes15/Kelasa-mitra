"""
Plain functions behind the three watsonx Orchestrate tools.

This file holds glue only. Every rule, score, distance, reason and template comes
from backend modules that orchestrate/build_kelasa_tools.py copies unchanged into
the package (tools/, models/, data/). Nothing here asks a model for a number.

The tools take the worker's own words and re-run the rules each time, so the agent
never has to pass a profile, coordinates or any number between tools.

All results are plain dicts (JSON-safe), never model objects.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from models.worker import WorkerProfile
from tools.fallback import extract_profile_fallback
from tools.follow_up import follow_up_for
from tools.job_ranker import rank_jobs
from tools.profile_builder import build_profile
from tools.skill_gap import compute_skill_gap

SUPPORTED_LANGUAGES = ("en", "kn", "hi")
REPLY_MATCHES = 3  # matches the agent repeats in its reply; the app shows all of them as cards

_JOBS: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "data" / "jobs_snapshot.json").read_text(encoding="utf-8")
)


def _language(ui_language: str) -> str:
    code = (ui_language or "").strip().lower()
    return code if code in SUPPORTED_LANGUAGES else "en"


def profile_for(worker_text: str, ui_language: str) -> WorkerProfile:
    """Rule-based profile, the same as the backend's with no LLM configured."""
    language = _language(ui_language)
    return build_profile(extract_profile_fallback(worker_text, language), worker_text, language)


def extract_profile_result(worker_text: str, ui_language: str) -> dict[str, Any]:
    profile = profile_for(worker_text, ui_language)
    question = follow_up_for(profile)
    return {
        "profile": profile.model_dump(),
        "profile_complete": question is None,
        "follow_up_question": question,
    }


def find_matches_result(worker_text: str, ui_language: str) -> dict[str, Any]:
    profile = profile_for(worker_text, ui_language)
    question = follow_up_for(profile)
    if question:
        return {"follow_up_question": question, "matches": [], "reply_lines": [question],
                "is_sample_data": True}
    matches = rank_jobs(profile, _JOBS)
    return {
        "follow_up_question": None,
        "matches": [match.model_dump() for match in matches],
        "reply_lines": [f"{m.job.title} ({m.job.employer}): {m.reason}" for m in matches[:REPLY_MATCHES]],
        "is_sample_data": True,
    }


def skill_gap_result(worker_text: str, ui_language: str) -> dict[str, Any]:
    profile = profile_for(worker_text, ui_language)
    question = follow_up_for(profile)
    if question:
        return {"follow_up_question": question, "gaps": [], "reply_lines": [question],
                "is_sample_data": True}
    result = compute_skill_gap(profile, _JOBS)
    return {
        "follow_up_question": None,
        "gaps": [gap.model_dump() for gap in result.gaps],
        "reply_lines": [gap.explanation for gap in result.gaps],
        "is_sample_data": result.is_synthetic,
    }
