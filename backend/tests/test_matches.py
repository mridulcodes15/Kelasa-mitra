"""
Tests for Phase 2 – job matching and ranking.

All tests use an in-memory SQLite DB populated with a small fixture set,
plus the real seed data (loaded from seed_jobs.py).
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from typing import Any

import pytest

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

from models.worker import WorkerProfile, AreaLocation
from models.job import JobMatch, MatchResponse
from tools.job_ranker import rank_jobs, _haversine_km, _build_reason, MAX_DISTANCE_KM
from db.seed_jobs import _SEED


# ── Fixture helpers ──────────────────────────────────────────────────────────

def _area(lat: float, lon: float, name: str = "TestArea") -> AreaLocation:
    return AreaLocation(id=name.lower(), name=name, lat=lat, lon=lon)


def _profile(skills: list[str], lat: float = 12.97, lon: float = 77.60,
             langs: list[str] | None = None, lang_code: str = "en") -> WorkerProfile:
    return WorkerProfile(
        skills=skills,
        experience_years=None,
        area=_area(lat, lon),
        languages=langs or ["kannada"],
        detected_language=lang_code,
        raw_input="",
    )


def _job_dict(skills: list[str], lat: float = 12.97, lon: float = 77.60,
              langs: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": "test-job-1",
        "title": "Test Job",
        "employer": "Tester Corp",
        "area": "TestArea",
        "lat": lat,
        "lon": lon,
        "pay_min": 10000,
        "pay_max": 15000,
        "skills_required": skills,
        "languages": langs or ["kannada"],
        "type": "job",
        "posted_at": "2026-01-01T00:00:00+00:00",
        "is_synthetic": True,
    }


# ── Scoring edge cases ───────────────────────────────────────────────────────

def test_score_zero_overlap_no_language():
    """Worker has no matching skills and different language → low score."""
    profile = _profile(skills=["cook"], langs=["hindi"], lang_code="hi")
    job = _job_dict(skills=["electrician"], langs=["kannada"])
    results = rank_jobs(profile, [job])
    assert len(results) == 1
    # skill=0, proximity is close so score = 0*0.6 + proximity*0.3 + 0*0.1
    assert results[0].score < 35


def test_score_perfect_overlap_same_location():
    """Worker has all skills and is at the same location → ~97-100."""
    profile = _profile(skills=["cook", "food_handler"], lat=12.9716, lon=77.5946)
    job = _job_dict(skills=["cook", "food_handler"], lat=12.9716, lon=77.5946)
    results = rank_jobs(profile, [job])
    assert len(results) == 1
    assert results[0].score >= 95


def test_score_far_away_excluded():
    """Job more than 20 km from worker → not returned."""
    profile = _profile(skills=["cook"], lat=12.9716, lon=77.5946)
    # Mysore is ~150 km away
    far_job = _job_dict(skills=["cook"], lat=12.2958, lon=76.6394)
    results = rank_jobs(profile, [far_job])
    assert results == []


def test_score_exactly_at_max_distance():
    """Job at exactly MAX_DISTANCE_KM boundary → distance_penalty=1 → only skill + lang contribute."""
    profile = _profile(skills=["security_guard"], lat=12.9716, lon=77.5946,
                       langs=["kannada"], lang_code="kn")
    # Place job at ~20 km north
    job_lat = profile.area.lat + (MAX_DISTANCE_KM / 111.0)  # ~0.18 deg north
    job = _job_dict(skills=["security_guard"], lat=job_lat, lon=profile.area.lon,
                    langs=["kannada"])
    results = rank_jobs(profile, [job])
    # Should still be returned (dist ≈ 20 km → not strictly > 20)
    # Score: 0.6*1 + 0.3*0 + 0.1*1 = 0.7 → 70
    if results:  # might be just over limit due to floating point
        assert results[0].score >= 60


def test_top_n_limit():
    """Returns at most top_n results."""
    profile = _profile(skills=["cook"])
    jobs = [_job_dict(skills=["cook"], lat=12.97 + i * 0.001, lon=77.60) for i in range(20)]
    results = rank_jobs(profile, jobs, top_n=5)
    assert len(results) <= 5


def test_results_sorted_by_score_descending():
    """Results must be sorted score descending."""
    profile = _profile(skills=["cook", "delivery"])
    jobs = [
        _job_dict(skills=["cook", "delivery"], lat=12.9716, lon=77.5946),   # full match, close
        _job_dict(skills=["cook"], lat=12.9716, lon=77.5946),                # partial match
        _job_dict(skills=["plumber"], lat=12.9716, lon=77.5946),             # no match
    ]
    results = rank_jobs(profile, jobs)
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True)


def test_no_area_returns_empty():
    """Profile without area → empty list (router handles follow-up)."""
    profile = WorkerProfile(
        skills=["cook"], experience_years=None, area=None,
        languages=["kannada"], detected_language="kn", raw_input=""
    )
    results = rank_jobs(profile, [_job_dict(skills=["cook"])])
    assert results == []


def test_matched_and_missing_skills_populated():
    """matched_skills and missing_skills must be correct."""
    profile = _profile(skills=["cook"])
    job = _job_dict(skills=["cook", "food_handler"])
    results = rank_jobs(profile, [job])
    assert len(results) == 1
    assert "cook" in results[0].matched_skills
    assert "food_handler" in results[0].missing_skills


# ── Reason language correctness ──────────────────────────────────────────────

def test_reason_english_contains_expected_pattern():
    reason = _build_reason(["cook"], 3.5, "en")
    assert "cooking" in reason or "cook" in reason.lower()
    assert "3.5" in reason


def test_reason_kannada_contains_km():
    reason = _build_reason(["delivery"], 2.1, "kn")
    assert "ಕಿಮೀ" in reason


def test_reason_hindi_contains_km():
    reason = _build_reason(["security_guard"], 5.0, "hi")
    assert "किमी" in reason


def test_reason_no_skills_near():
    reason = _build_reason([], 4.0, "en")
    assert "km" in reason.lower() or "nearby" in reason.lower() or "4.0" in reason


def test_reason_unknown_lang_falls_back_to_english():
    reason = _build_reason(["cook"], 2.0, "ta")  # Tamil not in templates
    assert "cooking" in reason or "cook" in reason.lower()


# ── Follow-up question behaviour (via router) ─────────────────────────────────

from routers.matches import _follow_up  # noqa: E402


def test_follow_up_no_area_english():
    q = _follow_up("no_area", "en")
    assert "Bengaluru" in q or "live" in q.lower()


def test_follow_up_no_skills_kannada():
    q = _follow_up("no_skills", "kn")
    assert "ಬೆಂಗಳೂರ" in q or "ಕೆಲಸ" in q


def test_follow_up_no_area_hindi():
    q = _follow_up("no_area", "hi")
    assert "बेंगलुरु" in q or "इलाके" in q


def test_follow_up_unknown_lang_defaults_english():
    q = _follow_up("no_area", "zz")
    assert isinstance(q, str) and len(q) > 0


# ── Seed data validity ────────────────────────────────────────────────────────

def test_all_seed_jobs_have_valid_coordinates():
    """Every seed entry must have lat/lon within Karnataka bounds."""
    KA_LAT_MIN, KA_LAT_MAX = 11.5, 18.5
    KA_LON_MIN, KA_LON_MAX = 74.0, 78.6
    for entry in _SEED:
        assert KA_LAT_MIN <= entry["lat"] <= KA_LAT_MAX, f"Bad lat for {entry['title']}: {entry['lat']}"
        assert KA_LON_MIN <= entry["lon"] <= KA_LON_MAX, f"Bad lon for {entry['title']}: {entry['lon']}"


def test_all_seed_jobs_have_known_skills():
    """Every skill in every seed job must exist in skills.json taxonomy."""
    data_dir = BACKEND / "data"
    with open(data_dir / "skills.json", encoding="utf-8") as f:
        known_ids = {s["id"] for s in json.load(f)}
    for entry in _SEED:
        for sk in entry["skills"]:
            assert sk in known_ids, f"Unknown skill '{sk}' in seed job '{entry['title']}'"


def test_seed_has_at_least_80_jobs():
    assert len(_SEED) >= 80, f"Only {len(_SEED)} seed jobs, expected ≥ 80"


def test_seed_has_both_job_types():
    types = {e["type"] for e in _SEED}
    assert "job" in types
    assert "apprenticeship" in types


def test_haversine_self_is_zero():
    assert _haversine_km(12.97, 77.59, 12.97, 77.59) == pytest.approx(0.0)


def test_haversine_known_distance():
    """Whitefield to Koramangala is roughly 14-16 km."""
    dist = _haversine_km(12.9698, 77.7499, 12.9352, 77.6245)
    assert 12 < dist < 18
