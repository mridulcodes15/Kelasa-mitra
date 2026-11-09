"""
Tests for Phase 1 – profile extraction.

Runs entirely against the offline fallback (no GROQ_API_KEY required).
Language is driven by ui_language (picker), not langdetect, so detected_language
is deterministic and the wide allow-lists are gone.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

# Force offline fallback for all tests
os.environ["GROQ_API_KEY"] = ""

from tools.profile_extractor import extract_profile  # noqa: E402
from models.worker import WorkerProfile  # noqa: E402

SAMPLES_PATH = Path(__file__).parent / "samples.json"
with open(SAMPLES_PATH, encoding="utf-8") as _f:
    _SAMPLES: list[dict[str, Any]] = json.load(_f)


def _sample_id(sample: dict[str, Any]) -> str:
    return f"sample_{sample['id']}_{sample['description'][:40]}"


@pytest.mark.parametrize("sample", _SAMPLES, ids=[_sample_id(s) for s in _SAMPLES])
def test_profile_extraction(sample: dict[str, Any]) -> None:
    """Offline fallback must satisfy every expected field in the sample."""
    ui_lang: str | None = sample.get("ui_language")
    profile: WorkerProfile = extract_profile(sample["input"], ui_language=ui_lang)
    expected: dict[str, Any] = sample["expected"]

    # ── skills ───────────────────────────────────────────────────────────────
    if "skills_contain" in expected:
        for skill_id in expected["skills_contain"]:
            assert skill_id in profile.skills, (
                f"[Sample {sample['id']}] Expected skill '{skill_id}' not found in {profile.skills!r}.\n"
                f"Input: {sample['input']!r}"
            )

    # ── experience ───────────────────────────────────────────────────────────
    if "experience_years" in expected and expected["experience_years"] is not None:
        assert profile.experience_years is not None, (
            f"[Sample {sample['id']}] experience_years is None, expected {expected['experience_years']}.\n"
            f"Input: {sample['input']!r}"
        )
        assert abs(profile.experience_years - expected["experience_years"]) < 0.6, (
            f"[Sample {sample['id']}] experience_years {profile.experience_years} != {expected['experience_years']}.\n"
            f"Input: {sample['input']!r}"
        )

    # ── area ─────────────────────────────────────────────────────────────────
    if "area_id" in expected:
        assert profile.area is not None, (
            f"[Sample {sample['id']}] area is None, expected id='{expected['area_id']}'.\n"
            f"Input: {sample['input']!r}"
        )
        assert profile.area.id == expected["area_id"], (
            f"[Sample {sample['id']}] area.id={profile.area.id!r}, expected {expected['area_id']!r}.\n"
            f"Input: {sample['input']!r}"
        )

    # ── languages spoken ─────────────────────────────────────────────────────
    if "languages_contain" in expected:
        for lang in expected["languages_contain"]:
            assert lang in profile.languages, (
                f"[Sample {sample['id']}] Expected language '{lang}' not in {profile.languages!r}.\n"
                f"Input: {sample['input']!r}"
            )

    # ── detected language (exact, driven by ui_language picker) ──────────────
    if "detected_language" in expected:
        assert profile.detected_language == expected["detected_language"], (
            f"[Sample {sample['id']}] detected_language={profile.detected_language!r}, "
            f"expected {expected['detected_language']!r}.\n"
            f"Input: {sample['input']!r}"
        )


def test_profile_returns_worker_profile_type() -> None:
    """Smoke-test: result is always a WorkerProfile, never raises."""
    result = extract_profile("I am a cook in Koramangala", ui_language="en")
    assert isinstance(result, WorkerProfile)
    assert result.raw_input != ""
    assert result.detected_language == "en"


def test_empty_input_does_not_crash() -> None:
    """Empty string should return an empty profile, not raise."""
    result = extract_profile("", ui_language="en")
    assert isinstance(result, WorkerProfile)
    assert result.skills == []


def test_ui_language_overrides_langdetect() -> None:
    """When ui_language=kn is passed, detected_language must be kn regardless of input."""
    # This English input would normally detect as "en"
    result = extract_profile("I am a cook", ui_language="kn")
    assert result.detected_language == "kn"


def test_unknown_ui_language_falls_back_to_langdetect() -> None:
    """An unknown ui_language value must not crash; langdetect takes over."""
    result = extract_profile("I am a security guard in Jayanagar", ui_language="zz")
    assert isinstance(result, WorkerProfile)
    # langdetect will return something — just confirm we don't crash
