"""
No skill recognised: when the worker said something but no skill in the demo's list was found,
the app does not repeat the generic question. It says so and offers the 10 most common skills
as chips (frontend/src/lib/skillChips.ts). No new skill is invented: "teacher" maps to nothing.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

from main import app  # noqa: E402
from models.worker import AreaLocation, WorkerProfile  # noqa: E402
from tests.test_demo_quality import _common_skills  # noqa: E402
from tools.follow_up import follow_up, follow_up_for  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

SKILLS = {s["id"]: s for s in json.loads((BACKEND / "data" / "skills.json").read_text(encoding="utf-8"))}
LABEL = {"en": "label_en", "kn": "label_kn", "hi": "label_hi"}
WHITEFIELD = AreaLocation(id="whitefield", name="Whitefield", lat=12.9698, lon=77.7499)


def _frontend_chips() -> list[str]:
    src = (ROOT / "frontend" / "src" / "lib" / "skillChips.ts").read_text(encoding="utf-8")
    return re.findall(r"^\s+'(\w+)',$", src, flags=re.M)


def test_chips_are_the_ten_most_common_skills():
    assert _frontend_chips() == _common_skills(10)


@pytest.mark.parametrize("lang", ["en", "kn", "hi"])
@pytest.mark.parametrize("skill_id", _common_skills(10))
def test_tapping_a_chip_adds_a_name_the_rules_recognise(skill_id, lang):
    """The chip adds the skill's name (in the picker language) to the worker's text."""
    profile = extract_profile(f"I live in Whitefield {SKILLS[skill_id][LABEL[lang]]}", ui_language=lang)
    assert profile.skills == [skill_id]
    assert follow_up_for(profile) is None


@pytest.mark.parametrize("lang", ["en", "kn", "hi"])
def test_unrecognised_work_gets_its_own_message(lang):
    profile = extract_profile("I am a teacher in Whitefield", ui_language=lang)
    assert profile.skills == []  # "teacher" is not mapped to anything
    question = follow_up_for(profile)
    assert question == follow_up("unknown_work", lang)
    assert question != follow_up("no_skills", lang)


def test_unknown_work_message_text():
    assert follow_up("unknown_work", "en") == (
        "I did not recognise that kind of work yet. This demo covers jobs like these - tap one or say it again."
    )


def test_with_nothing_said_the_generic_question_stays():
    profile = WorkerProfile(skills=[], area=WHITEFIELD, languages=[], detected_language="en", raw_input="")
    assert follow_up_for(profile) == follow_up("no_skills", "en")


def test_missing_area_is_still_asked_first():
    profile = extract_profile("I am a teacher", ui_language="en")
    assert follow_up_for(profile) == follow_up("no_area", "en")


@pytest.mark.parametrize("lang", ["en", "kn", "hi"])
def test_matches_endpoint_returns_it(lang):
    profile = extract_profile("I am a teacher in Whitefield", ui_language=lang).model_dump()
    body = TestClient(app).post("/api/matches", json={"profile": profile}).json()
    assert body["matches"] == [] and body["follow_up_question"] == follow_up("unknown_work", lang)
