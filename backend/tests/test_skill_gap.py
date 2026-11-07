"""
Tests for Phase 3 – skill gap analysis.

The fixture is small enough to compute by hand. Every job is at the worker's exact
location with a shared language, so:
    score = 60 * (matched / required) + 30 + 10

Worker: skills [cook]. Strong match means score >= 60.
  cook-1     needs [cook]         score 100  already strong, midpoint pay 12,000
  elec-1     needs [electrician]  score 40   midpoint 20,000
  elec-2     needs [electrician]  score 40   midpoint 16,000
  plumb-1    needs [plumber]      score 40   midpoint 18,000
  tailor-1   needs [tailoring]    score 40   midpoint 9,000
  far-1      needs [electrician]  over 20 km away, excluded

Current average pay = 12,000.
  electrician: unlocks elec-1, elec-2 -> 2 jobs, average 18,000, uplift 6,000
  plumber:     unlocks plumb-1        -> 1 job,  average 18,000, uplift 6,000
  tailoring:   unlocks tailor-1       -> 1 job,  average  9,000, uplift 0 (never negative)
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

from models.worker import AreaLocation, WorkerProfile  # noqa: E402
from tools.skill_gap import compute_skill_gap, _GAP_TEMPLATES, _GAP_NO_UPLIFT_TEMPLATES  # noqa: E402

LAT, LON = 12.97, 77.60


def _job(id_: str, skills: list[str], pay_min: int, pay_max: int,
         lat: float = LAT, lon: float = LON) -> dict[str, Any]:
    return {
        "id": id_, "title": id_, "employer": "Fixture Co", "area": "Test", "lat": lat, "lon": lon,
        "pay_min": pay_min, "pay_max": pay_max, "skills_required": skills,
        "languages": ["kannada"], "type": "job", "posted_at": "2026-01-01T00:00:00+00:00",
        "is_synthetic": True,
    }


JOBS = [
    _job("cook-1", ["cook"], 10000, 14000),
    _job("elec-1", ["electrician"], 18000, 22000),
    _job("elec-2", ["electrician"], 14000, 18000),
    _job("plumb-1", ["plumber"], 16000, 20000),
    _job("tailor-1", ["tailoring"], 8000, 10000),
    _job("far-1", ["electrician"], 90000, 99000, lat=12.2958, lon=76.6394),
]


def _profile(skills: list[str] | None = None, lang: str = "en") -> WorkerProfile:
    return WorkerProfile(
        skills=["cook"] if skills is None else skills,
        area=AreaLocation(id="test", name="Test", lat=LAT, lon=LON),
        languages=["kannada"],
        detected_language=lang,
    )


# ── Numbers match the hand computation ───────────────────────────────────────

def test_numbers_equal_hand_computed_fixture():
    gaps = compute_skill_gap(_profile(), JOBS).gaps
    assert [(g.skill_id, g.jobs_unlocked, g.avg_pay_uplift_inr) for g in gaps] == [
        ("electrician", 2, 6000),
        ("plumber", 1, 6000),
        ("tailoring", 1, 0),
    ]


def test_far_job_is_not_counted():
    """far-1 would make electrician 3 jobs and raise the average if it were counted."""
    electrician = compute_skill_gap(_profile(), JOBS).gaps[0]
    assert electrician.jobs_unlocked == 2


def test_response_is_marked_synthetic():
    assert compute_skill_gap(_profile(), JOBS).is_synthetic is True


# ── Ranking order ────────────────────────────────────────────────────────────

def test_ranked_by_jobs_unlocked_first():
    gaps = compute_skill_gap(_profile(), JOBS).gaps
    assert gaps[0].jobs_unlocked > gaps[1].jobs_unlocked


def test_same_job_count_ranked_by_uplift():
    gaps = compute_skill_gap(_profile(), JOBS).gaps
    assert [g.skill_id for g in gaps[1:]] == ["plumber", "tailoring"]


def test_full_tie_ranked_by_skill_id():
    jobs = [_job("base", ["cook"], 10000, 10000)] + [
        _job(s, [s], 10000, 10000) for s in ("welder", "barber", "plumber", "mason")
    ]
    assert [g.skill_id for g in compute_skill_gap(_profile(), jobs).gaps] == ["barber", "mason", "plumber"]


def test_returns_at_most_three_gaps():
    jobs = [_job(s, [s], 10000, 10000) for s in ("welder", "barber", "plumber", "mason", "tailoring")]
    assert len(compute_skill_gap(_profile([]), jobs).gaps) == 3


def test_ties_do_not_depend_on_the_hash_seed():
    """Set order varies with PYTHONHASHSEED, which used to change the third gap."""
    script = (
        "import sys; sys.path.insert(0, '.');"
        "from db.seed_jobs import _SEED;"
        "from models.worker import WorkerProfile, AreaLocation;"
        "from tools.skill_gap import compute_skill_gap;"
        "jobs=[dict(id=str(i),title=e['title'],employer=e['employer'],area=e['area'],lat=e['lat'],"
        "lon=e['lon'],pay_min=e['pay_min'],pay_max=e['pay_max'],skills_required=e['skills'],"
        "languages=e['languages'],type=e['type'],posted_at='x',is_synthetic=True)"
        " for i,e in enumerate(_SEED)];"
        "p=WorkerProfile(skills=['cook'],languages=['kannada'],"
        "area=AreaLocation(id='k',name='k',lat=12.9352,lon=77.6245));"
        "print([g.skill_id for g in compute_skill_gap(p,jobs).gaps])"
    )
    outputs = set()
    for seed in ("1", "2", "3"):
        env = {**os.environ, "PYTHONHASHSEED": seed, "PYTHONIOENCODING": "utf-8"}
        result = subprocess.run([sys.executable, "-c", script], cwd=BACKEND, env=env,
                                capture_output=True, text=True, encoding="utf-8", check=True)
        outputs.add(result.stdout.strip())
    assert len(outputs) == 1, outputs


# ── Zero-gap and no-baseline cases ───────────────────────────────────────────

def test_zero_gap_when_worker_has_every_skill():
    skills = sorted({s for j in JOBS for s in j["skills_required"]})
    assert compute_skill_gap(_profile(skills), JOBS).gaps == []


def test_zero_gap_when_learning_unlocks_nothing():
    assert compute_skill_gap(_profile(), [_job("cook-1", ["cook"], 10000, 14000)]).gaps == []


def test_no_area_returns_no_gaps():
    profile = WorkerProfile(skills=["cook"], area=None, languages=[], detected_language="en")
    assert compute_skill_gap(profile, JOBS).gaps == []


@pytest.mark.parametrize("lang", ["en", "kn", "hi"])
def test_no_current_matches_makes_no_pay_claim(lang):
    """With nothing to compare against, the whole salary used to show as 'more per month'."""
    gaps = compute_skill_gap(_profile([], lang), JOBS).gaps
    assert gaps
    for gap in gaps:
        assert gap.jobs_unlocked > 0
        assert gap.avg_pay_uplift_inr == 0
        assert "₹" not in gap.explanation


# ── Templates in three languages ─────────────────────────────────────────────

@pytest.mark.parametrize("lang,expected", [
    ("en", "Learning Electrician could unlock 2 more jobs near you, paying about ₹6,000 more per month."),
    ("kn", "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ 2 ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು, ತಿಂಗಳಿಗೆ ಸುಮಾರು ₹6,000 ಹೆಚ್ಚು ಸಂಪಾದಿಸಬಹುದು."),
    ("hi", "इलेक्ट्रीशियन सीखने से आपके आस-पास 2 नए काम का मौका मिल सकता है, और महीने में लगभग ₹6,000 ज़्यादा कमाई हो सकती है।"),
])
def test_uplift_template(lang, expected):
    assert compute_skill_gap(_profile(lang=lang), JOBS).gaps[0].explanation == expected


@pytest.mark.parametrize("lang,expected", [
    ("en", "Learning Tailoring could unlock 1 more job near you."),
    ("kn", "ಹೊಲಿಗೆ ಕಲಿತರೆ ನಿಮ್ಮ ಹತ್ತಿರ 1 ಹೊಸ ಕೆಲಸದ ಅವಕಾಶ ಸಿಗಬಹುದು."),
    ("hi", "सिलाई सीखने से आपके आस-पास 1 नए काम का मौका मिल सकता है।"),
])
def test_no_uplift_template(lang, expected):
    assert compute_skill_gap(_profile(lang=lang), JOBS).gaps[2].explanation == expected


@pytest.mark.parametrize("lang,label", [("en", "Electrician"), ("kn", "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್"), ("hi", "इलेक्ट्रीशियन")])
def test_label_is_in_the_worker_language(lang, label):
    gap = compute_skill_gap(_profile(lang=lang), JOBS).gaps[0]
    assert gap.label == label
    assert gap.label_en == "Electrician"


def test_unknown_language_falls_back_to_english():
    assert compute_skill_gap(_profile(lang="ta"), JOBS).gaps[0].explanation.startswith("Learning")


def test_templates_have_no_broken_hindi_plural():
    for templates in (_GAP_TEMPLATES, _GAP_NO_UPLIFT_TEMPLATES):
        assert "कामें" not in templates["hi"]
        assert "pl_hi" not in templates["hi"] and "pl_kn" not in templates["kn"]


def test_gap_includes_a_learning_path():
    assert len(compute_skill_gap(_profile(), JOBS).gaps[0].learning_path) == 3


# ── Router ───────────────────────────────────────────────────────────────────

@pytest.fixture
def client(monkeypatch):
    """No context manager, so startup seeding never touches the real database."""
    import routers.skill_gap as router_module
    from main import app
    monkeypatch.setattr(router_module, "get_all_jobs", lambda: JOBS)
    return TestClient(app)


def test_router_is_in_openapi(client):
    assert "/api/skill-gap" in client.get("/openapi.json").json()["paths"]


def test_router_returns_computed_gaps(client):
    body = client.post("/api/skill-gap", json={"profile": _profile().model_dump()}).json()
    assert [g["skill_id"] for g in body["gaps"]] == ["electrician", "plumber", "tailoring"]
    assert body["is_synthetic"] is True
