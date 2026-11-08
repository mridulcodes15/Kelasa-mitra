"""
Missing-area follow-up: the 8 area chips the app offers must each resolve to their area in
en/kn/hi, and naming only the city ("Bangalore") is treated as no area and re-asked with
different wording instead of repeating the same question.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

from tools.follow_up import follow_up, follow_up_for, mentions_city_only_name  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

AREAS = {a["id"]: a for a in json.loads((BACKEND / "data" / "areas.json").read_text(encoding="utf-8"))}
CHIP_IDS = ["whitefield", "koramangala", "jayanagar", "electronic_city",
            "yelahanka", "marathahalli", "hsr_layout", "hoodi"]
NAME_FIELD = {"en": "name", "kn": "name_kn", "hi": "name_hi"}


def _frontend_chips() -> list[dict[str, str]]:
    """Read the chip list from frontend/src/lib/areaChips.ts (one object per line)."""
    src = (ROOT / "frontend" / "src" / "lib" / "areaChips.ts").read_text(encoding="utf-8")
    pattern = r"\{ id: '(\w+)', en: '([^']+)', kn: '([^']+)', hi: '([^']+)' \}"
    return [dict(zip(("id", "en", "kn", "hi"), m)) for m in re.findall(pattern, src)]


def test_frontend_chips_are_the_8_areas_with_areas_json_names():
    chips = _frontend_chips()
    assert [c["id"] for c in chips] == CHIP_IDS
    for chip in chips:
        area = AREAS[chip["id"]]
        for lang, field in NAME_FIELD.items():
            assert chip[lang] == area[field], (chip["id"], lang)


@pytest.mark.parametrize("lang", ["en", "kn", "hi"])
@pytest.mark.parametrize("area_id", CHIP_IDS)
def test_tapping_a_chip_resolves_the_area(area_id, lang):
    """A chip tap appends the area name in the chosen language to what the worker said."""
    text = f"I am a cook in Bangalore {AREAS[area_id][NAME_FIELD[lang]]}"
    profile = extract_profile(text, ui_language=lang)
    assert profile.area is not None and profile.area.id == area_id
    assert follow_up_for(profile) is None


@pytest.mark.parametrize("text", [
    "I am a cook in Bangalore",
    "I cook, I live in Bengaluru",
    "driver, banglore, 3 years",
    "ನಾನು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ",
    "ನಾನು ಬೆಂಗಳೂರು ಡ್ರೈವರ್",
    "मैं बेंगलुरु में ड्राइवर हूँ",
    "मैं बैंगलोर में कुक हूँ",
])
def test_city_name_alone_is_no_area_and_gets_the_city_question(text):
    profile = extract_profile(text)
    assert profile.area is None
    lang = profile.detected_language
    question = follow_up_for(profile)
    assert question == follow_up("city_only", lang)
    assert question != follow_up("no_area", lang)


def test_no_place_at_all_keeps_the_plain_question():
    profile = extract_profile("I am a cook")
    assert follow_up_for(profile) == follow_up("no_area", "en")


def test_area_with_city_needs_no_follow_up():
    profile = extract_profile("I am a cook in Whitefield, Bangalore")
    assert profile.area.id == "whitefield"
    assert follow_up_for(profile) is None


@pytest.mark.parametrize("text", ["Blrx", "bangalorean food", "Bengalurus", "I am a cook"])
def test_city_detector_needs_the_whole_word(text):
    assert not mentions_city_only_name(text)


def test_city_question_exists_in_every_language():
    for lang in ("en", "kn", "hi"):
        assert follow_up("city_only", lang) != follow_up("no_area", lang)
