"""
Demo-quality checks on the real seed data: sensible top matches, no unmatched "matches"
when real ones exist, and pay uplift that comes from the job data.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from collections import Counter
from typing import Any

import pytest

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

from db.seed_jobs import build_seed_rows  # noqa: E402
from models.worker import AreaLocation, WorkerProfile  # noqa: E402
from tools.job_ranker import MIN_SKILL_MATCHES, _haversine_km, rank_jobs  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402
from tools.skill_gap import STRONG_MATCH_THRESHOLD, _strong_match_score, compute_skill_gap  # noqa: E402

JOBS = build_seed_rows()
SAMPLES = json.loads((BACKEND / "tests" / "samples.json").read_text(encoding="utf-8"))
COOK_WHITEFIELD = "I cook, 2 years, I live in Whitefield"
PLAUSIBLE_KM = 8.0

CASES = [(f"sample-{s['id']}", s["input"], s["ui_language"]) for s in SAMPLES]
CASES.append(("cook-whitefield", COOK_WHITEFIELD, "en"))


# ── 1. Every sample's top match is relevant and near ─────────────────────────

@pytest.mark.parametrize("name,text,lang", CASES, ids=[c[0] for c in CASES])
def test_top_match_shares_a_skill_and_is_near(name, text, lang):
    profile = extract_profile(text, ui_language=lang)
    matches = rank_jobs(profile, JOBS)
    assert matches, name
    top = matches[0]
    assert set(top.job.skills_required) & set(profile.skills), f"{name}: {top.job.title}"
    assert top.distance_km <= PLAUSIBLE_KM, f"{name}: {top.job.title} is {top.distance_km} km away"


def test_cook_in_whitefield_sees_kitchen_jobs_nearby_first():
    matches = rank_jobs(extract_profile(COOK_WHITEFIELD, ui_language="en"), JOBS)
    assert matches[0].distance_km <= 3
    assert all("cook" in m.job.skills_required for m in matches[:3])
    east = {"Whitefield", "Hoodi", "Marathahalli", "KR Puram"}
    assert sum(m.job.area in east for m in matches[:5]) >= 4


# ── 1b. Every area chip x common skill gets a near job that uses the skill ────

AREAS = {a["id"]: a for a in json.loads((BACKEND / "data" / "areas.json").read_text(encoding="utf-8"))}
CHIP_AREAS = ["whitefield", "koramangala", "jayanagar", "electronic_city",
              "yelahanka", "marathahalli", "hsr_layout", "hoodi"]  # frontend/src/lib/areaChips.ts
COVERAGE_KM = 5.0


def _common_skills(n: int = 8) -> list[str]:
    """The n skills found most often in the sample inputs (samples.json + eval_samples.json).
    Ties: more often in the 13 demo samples first, then alphabetical."""
    evals = json.loads((BACKEND / "tests" / "eval_samples.json").read_text(encoding="utf-8"))["samples"]
    demo: Counter[str] = Counter()
    for s in SAMPLES:
        demo.update(extract_profile(s["input"], ui_language=s["ui_language"]).skills)
    both = Counter(demo)
    for s in evals:
        both.update(extract_profile(s["input"], ui_language=s["language"]).skills)
    return sorted(both, key=lambda k: (-both[k], -demo[k], k))[:n]


def test_common_skills_are_the_expected_eight():
    assert _common_skills() == ["two_wheeler", "hotel_helper", "driver_car", "tailoring",
                                "housekeeping", "security_guard", "cook", "delivery"]


@pytest.mark.parametrize("skill", _common_skills())
@pytest.mark.parametrize("area_id", CHIP_AREAS)
def test_area_chip_and_common_skill_coverage(area_id, skill):
    area = AREAS[area_id]
    profile = WorkerProfile(skills=[skill], languages=[], detected_language="en",
                            area=AreaLocation(id=area_id, name=area["name"], lat=area["lat"], lon=area["lon"]))
    top = rank_jobs(profile, JOBS)[0]
    assert skill in top.job.skills_required, f"{area_id}/{skill}: {top.job.title} ({top.job.area})"
    assert top.distance_km <= COVERAGE_KM, f"{area_id}/{skill}: {top.job.title} is {top.distance_km} km away"


def test_cook_in_jayanagar_is_not_sent_to_whitefield():
    top = rank_jobs(extract_profile("I am a cook in Jayanagar", ui_language="en"), JOBS)[0]
    assert "cook" in top.job.skills_required and top.distance_km <= COVERAGE_KM


def test_added_jobs_are_synthetic_and_in_bengaluru():
    for job in JOBS[80:]:
        assert job["is_synthetic"]
        assert 12.7 < job["lat"] < 13.2 and 77.3 < job["lon"] < 77.9, job["title"]


# ── 2. Jobs with no matched skill are not shown as matches when real ones exist ──

AREA = AreaLocation(id="t", name="T", lat=12.97, lon=77.60)


def _job(id_: str, skills: list[str], lat: float = 12.97) -> dict[str, Any]:
    return {"id": id_, "title": id_, "employer": "Fixture Co", "area": "T", "lat": lat, "lon": 77.60,
            "pay_min": 10000, "pay_max": 12000, "skills_required": skills, "languages": ["kannada"],
            "type": "job", "posted_at": "2026-01-01T00:00:00+00:00", "is_synthetic": True}


def _cook() -> WorkerProfile:
    return WorkerProfile(skills=["cook"], area=AREA, languages=["kannada"], detected_language="en")


def test_unmatched_jobs_hidden_when_enough_skill_matches():
    jobs = [_job(f"cook-{i}", ["cook"], lat=12.97 + i * 0.02) for i in range(MIN_SKILL_MATCHES)]
    jobs.append(_job("plumber-next-door", ["plumber"]))
    ids = [m.job.id for m in rank_jobs(_cook(), jobs)]
    assert "plumber-next-door" not in ids
    assert len(ids) == MIN_SKILL_MATCHES


def test_unmatched_jobs_still_shown_when_few_skill_matches():
    jobs = [_job(f"cook-{i}", ["cook"]) for i in range(MIN_SKILL_MATCHES - 1)]
    jobs.append(_job("plumber-next-door", ["plumber"]))
    ids = [m.job.id for m in rank_jobs(_cook(), jobs)]
    assert "plumber-next-door" in ids


def test_far_skill_matches_do_not_count():
    """Skill-matched jobs beyond 20 km are excluded, so they cannot hide nearby jobs."""
    far = [_job(f"far-cook-{i}", ["cook"], lat=12.2958) for i in range(MIN_SKILL_MATCHES)]
    ids = [m.job.id for m in rank_jobs(_cook(), far + [_job("plumber-next-door", ["plumber"])])]
    assert ids == ["plumber-next-door"]


@pytest.mark.parametrize("name,text,lang", CASES, ids=[c[0] for c in CASES])
def test_seed_matches_all_use_a_worker_skill(name, text, lang):
    matches = rank_jobs(extract_profile(text, ui_language=lang), JOBS)
    if sum(bool(m.matched_skills) for m in matches) >= MIN_SKILL_MATCHES:
        assert all(m.matched_skills for m in matches), name


# ── 3. Pay uplift comes from the job data ────────────────────────────────────

def _midpoint(job: dict[str, Any]) -> float:
    return (job["pay_min"] + job["pay_max"]) / 2


def _uplift_by_hand(profile: WorkerProfile, skill: str, jobs: list[dict[str, Any]]) -> int:
    """Independent re-computation of the documented rule, straight from the job rows."""
    lat, lon = profile.area.lat, profile.area.lon
    near = [j for j in jobs if _haversine_km(lat, lon, j["lat"], j["lon"]) <= 20]
    strong = lambda skills, j: _strong_match_score(skills, j, lat, lon, profile.languages) >= STRONG_MATCH_THRESHOLD  # noqa: E731
    current = [j for j in near if strong(profile.skills, j)]
    unlocked = [j for j in near if strong(profile.skills + [skill], j) and j not in current]
    base = sum(map(_midpoint, current)) / len(current)
    return max(0, round(sum(map(_midpoint, unlocked)) / len(unlocked) - base))


def test_cook_learning_food_handling_pays_more_per_the_data():
    profile = extract_profile(COOK_WHITEFIELD, ui_language="en")
    gaps = {g.skill_id: g for g in compute_skill_gap(profile, JOBS).gaps}
    assert "food_handler" in gaps
    assert gaps["food_handler"].avg_pay_uplift_inr > 0
    assert gaps["food_handler"].avg_pay_uplift_inr == _uplift_by_hand(profile, "food_handler", JOBS)
    assert "₹" in gaps["food_handler"].explanation


def test_uplift_is_not_zero_across_the_board():
    positive = 0
    for _, text, lang in CASES:
        profile = extract_profile(text, ui_language=lang)
        positive += any(g.avg_pay_uplift_inr > 0 for g in compute_skill_gap(profile, JOBS).gaps)
    assert positive >= len(CASES) // 2


def test_uplift_disappears_when_the_data_has_no_pay_differences():
    """Proves the uplift is computed from pay in the data, not hard-coded."""
    flat = [{**j, "pay_min": 15000, "pay_max": 15000} for j in JOBS]
    for _, text, lang in CASES:
        profile = extract_profile(text, ui_language=lang)
        assert all(g.avg_pay_uplift_inr == 0 for g in compute_skill_gap(profile, flat).gaps)
