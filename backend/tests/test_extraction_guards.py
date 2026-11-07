"""Regression tests for rule-based matching false positives and provider validation."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import tools.provider as provider  # noqa: E402
from tools.fallback import extract_profile_fallback, lookup_area  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

with open(BACKEND / "data" / "areas.json", encoding="utf-8") as _f:
    AREAS = json.load(_f)


# ── Word-boundary matching ───────────────────────────────────────────────────

@pytest.mark.parametrize("text,not_expected", [
    ("I am a cook in Jayanagar", "babysitter"),
    ("I am a cook in Vijayanagar", "babysitter"),
    ("I kindly want a job near Whitefield", "driving_licence"),
    ("I want a post near Whitefield", "pos_billing"),
    ("My work was excellent", "data_entry"),
    ("We are from Somalia", "gardener"),
])
def test_short_latin_synonym_needs_word_boundary(text, not_expected):
    assert not_expected not in extract_profile_fallback(text, "en")["skills"]


@pytest.mark.parametrize("text,expected", [
    ("I have a DL", "driving_licence"),
    ("worked at a POS counter", "pos_billing"),
    ("we are cooks", "cook"),
    ("an aya for two years", "babysitter"),
])
def test_short_latin_synonym_still_matches_as_a_word(text, expected):
    assert expected in extract_profile_fallback(text, "en")["skills"]


def test_ambiguous_hindi_word_is_not_a_skill():
    """आया also means "came"."""
    assert "babysitter" not in extract_profile_fallback("मैं काम करने आया हूँ", "hi")["skills"]


def test_short_indic_term_needs_left_boundary():
    """नाई (barber) must not match inside बनाई (made)."""
    assert "barber" not in extract_profile_fallback("मैंने रोटी बनाई", "hi")["skills"]


def test_inflected_indic_term_still_matches():
    """A suffix on the right is normal in Kannada and must still match."""
    assert "two_wheeler" in extract_profile_fallback("ನಾನು ಬೈಕ್‌ನಲ್ಲಿ ಹೋಗುತ್ತೇನೆ", "kn")["skills"]


def test_no_area_name_produces_a_skill():
    """Saying only where you live must never add a skill."""
    for area in AREAS:
        for alias in area["aliases"]:
            skills = extract_profile_fallback(alias, "en")["skills"]
            assert skills == [], f"{alias!r} produced {skills}"


# ── Kannada area aliases ─────────────────────────────────────────────────────

@pytest.mark.parametrize("text,area_id", [
    ("ನಾನು ವಿಜಯನಗರದಲ್ಲಿ ಇರುತ್ತೇನೆ", "vijayanagar"),
    ("ನಾನು ನಾಗರಭಾವಿಯಲ್ಲಿ ಇರುತ್ತೇನೆ", "nagarbhavi"),
    ("ನಾನು ಜಯನಗರದಲ್ಲಿ ಇರುತ್ತೇನೆ", "jayanagar"),
])
def test_kannada_area_resolves(text, area_id):
    assert extract_profile_fallback(text, "kn")["area"]["id"] == area_id


@pytest.mark.parametrize("area", AREAS, ids=[a["id"] for a in AREAS])
@pytest.mark.parametrize("field", ["name", "name_kn", "name_hi"])
def test_every_area_name_resolves_to_itself(area, field):
    found = extract_profile_fallback(area[field], "en")["area"]
    assert found is not None and found["id"] == area["id"]


# ── Provider: the LLM never supplies numbers ─────────────────────────────────

TEXT = "I am a cook, 3 years experience, I live in Whitefield"


@pytest.fixture
def fake_llm(monkeypatch):
    """Make call_llm take the LLM path without any network call or real key."""
    def install(raw):
        monkeypatch.setenv("GROQ_API_KEY", "test-placeholder")
        monkeypatch.setattr(provider, "_GROQ_AVAILABLE", True)
        monkeypatch.setattr(provider, "_cached_llm_call", lambda *a: raw)
    return install


def test_llm_area_name_uses_coordinates_from_areas_json(fake_llm):
    fake_llm(json.dumps({"skills": ["cook"], "area": "Koramangala", "languages": ["english"]}))
    result = provider.call_llm(TEXT, "en")
    assert result["area"] == lookup_area("koramangala")
    assert result["skills"] == ["cook"]


def test_llm_numbers_are_ignored(fake_llm):
    fake_llm(json.dumps({
        "skills": ["cook"], "area": "Whitefield", "languages": [],
        "experience_years": 99, "lat": 1.0, "lon": 2.0,
    }))
    result = provider.call_llm(TEXT, "en")
    assert result["experience_years"] == 3.0  # parsed from the text by rules
    assert result["area"]["lat"] == lookup_area("whitefield")["lat"]


@pytest.mark.parametrize("raw", [
    "not json at all",
    "[1, 2, 3]",
    json.dumps({"skills": "cook", "area": None, "languages": []}),
    json.dumps({"skills": [1, 2], "area": None, "languages": []}),
    json.dumps({"skills": ["cook"], "area": {"id": "x", "name": "y"}, "languages": []}),
    json.dumps({"skills": ["cook"], "area": {"id": "x", "lat": 1, "lon": 2}, "languages": []}),
    json.dumps({"skills": ["cook"], "area": 12.9, "languages": []}),
    json.dumps({"skills": ["cook"], "area": None, "languages": "english"}),
])
def test_malformed_llm_output_falls_back_to_rules(fake_llm, raw):
    fake_llm(raw)
    assert provider.call_llm(TEXT, "en") == extract_profile_fallback(TEXT, "en")


def test_unknown_llm_area_name_uses_rule_based_area(fake_llm):
    fake_llm(json.dumps({"skills": ["cook"], "area": "Atlantis", "languages": []}))
    assert provider.call_llm(TEXT, "en")["area"]["id"] == "whitefield"


def test_invented_llm_skill_is_dropped(fake_llm):
    fake_llm(json.dumps({"skills": ["cook", "astronaut"], "area": None, "languages": []}))
    assert provider.call_llm(TEXT, "en")["skills"] == ["cook"]


def test_extract_profile_survives_malformed_llm_area(fake_llm):
    """This input used to raise KeyError: 'lat' outside any fallback."""
    fake_llm(json.dumps({"skills": ["cook"], "area": {"id": "whitefield", "name": "Whitefield"}}))
    assert extract_profile(TEXT, ui_language="en").area.id == "whitefield"


def test_prompt_does_not_ask_for_numbers():
    prompt = provider._build_prompt("x", ["cook"], AREAS)
    assert "Do not output any numbers" in prompt
    assert "experience_years" not in prompt
    assert "lat, lon" not in prompt
