"""Checks on learning paths, distance reasons, sample data, review docs and repo files."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from routers.matches import _FOLLOW_UP  # noqa: E402
from tools.job_ranker import _REASON_TEMPLATES, _build_reason  # noqa: E402
from tools.profile_extractor import _resolve_language  # noqa: E402
from tools.skill_gap import _GAP_NO_UPLIFT_TEMPLATES, _GAP_TEMPLATES  # noqa: E402

PATHS = json.loads((BACKEND / "data" / "learning_paths.json").read_text(encoding="utf-8"))
SAMPLES = json.loads((BACKEND / "tests" / "samples.json").read_text(encoding="utf-8"))

NAMED_THINGS = re.compile(
    r"apna|naukri|urban ?clap|urban ?company|swiggy|zomato|\bola\b|uber|dmart|reliance|amazon|flipkart|"
    r"delhivery|concentrix|teleperformance|\bhcl\b|nightingales|icliniq|portea|babychakra|care\.com|"
    r"gold's gym|cult\.fit|sulekha|asian paints|washmart|uclean|safexpress|\bdhl\b|trucksuvidha|"
    r"namma auto|duolingo|british council|youtube|st john|red cross|daikin|voltas|\bnsdc\b|\biti\b|"
    r"psara|fssai|foscos|\bbocw\b|mgnrega|krishi|\bbbmp\b|\bbmtc\b|asme|\baws\b|\bcpt\b|"
    r"skill india|\bcsc\b|ms word|mcwog|mcwg|aadhaar|kyc|bank details|http|www\.",
    re.IGNORECASE,
)


# ── Learning paths ───────────────────────────────────────────────────────────

def test_named_things_pattern_can_fail():
    assert NAMED_THINGS.search("Register on UrbanCompany")
    assert not NAMED_THINGS.search("Apply to hotels near you")


@pytest.mark.parametrize("skill", sorted(PATHS))
def test_learning_steps_name_no_company_course_institute_or_url(skill):
    for step in PATHS[skill]["steps"]:
        assert not NAMED_THINGS.search(step["action"]), f"{skill} step {step['step']}: {step['action']}"


@pytest.mark.parametrize("skill", sorted(PATHS))
def test_learning_steps_have_expected_fields(skill):
    steps = PATHS[skill]["steps"]
    assert [s["step"] for s in steps] == [1, 2, 3]
    for step in steps:
        assert "_TODO" in step
        assert step["weeks"] > 0
        assert step["approx_cost_inr"] >= 0


# ── Approximate distance reasons ─────────────────────────────────────────────

@pytest.mark.parametrize("lang,phrase", [("en", "in your area"), ("kn", "ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ"), ("hi", "आपके इलाके में")])
@pytest.mark.parametrize("matched", [["cook"], []])
def test_under_1km_says_in_your_area(lang, phrase, matched):
    reason = _build_reason(matched, 0.6, lang)
    assert phrase in reason.lower()
    assert "0.6" not in reason


@pytest.mark.parametrize("lang,marker", [("en", "~2.4"), ("kn", "ಸರಿಸುಮಾರು 2.4"), ("hi", "लगभग 2.4")])
@pytest.mark.parametrize("matched", [["cook"], []])
def test_over_1km_is_marked_approximate(lang, marker, matched):
    assert marker in _build_reason(matched, 2.37, lang)


def test_1km_exactly_uses_a_distance():
    assert "in your area" not in _build_reason(["cook"], 1.0, "en")


# ── Sample and language claims ───────────────────────────────────────────────

def test_sample_13_is_real_devanagari():
    text = next(s for s in SAMPLES if s["id"] == 13)["input"]
    letters = [c for c in text if c.isalpha()]
    assert letters
    assert all("ऀ" <= c <= "ॿ" for c in letters)
    assert "�" not in text and "?" not in text


def test_ui_language_is_primary():
    """English text with the Hindi picker stays Hindi: langdetect is not consulted."""
    assert _resolve_language("I am a security guard in Jayanagar", "hi") == "hi"
    assert _resolve_language("I am a security guard in Jayanagar", " KN ") == "kn"


def test_langdetect_is_only_a_fallback(monkeypatch):
    import tools.profile_extractor as extractor

    calls = []

    def fake_detect(text):
        calls.append(text)
        return "hi"

    monkeypatch.setattr(extractor, "detect", fake_detect)
    assert extractor._resolve_language("text", "kn") == "kn"
    assert calls == []
    assert extractor._resolve_language("text", None) == "hi"
    assert extractor._resolve_language("text", "zz") == "hi"
    assert calls == ["text", "text"]


# ── Template review list ─────────────────────────────────────────────────────

def test_every_backend_template_is_listed_for_review():
    doc = (ROOT / "docs" / "TEMPLATES_TO_REVIEW.md").read_text(encoding="utf-8")
    assert "not reviewed" in doc
    tables = [_REASON_TEMPLATES[lang] for lang in ("kn", "hi")]
    tables += [{"t": _GAP_TEMPLATES[lang], "u": _GAP_NO_UPLIFT_TEMPLATES[lang]} for lang in ("kn", "hi")]
    tables += [{k: v[lang] for k, v in _FOLLOW_UP.items()} for lang in ("kn", "hi")]
    for table in tables:
        for text in table.values():
            assert text in doc, text


def test_every_screen_string_is_listed_for_review():
    doc = (ROOT / "docs" / "TEMPLATES_TO_REVIEW.md").read_text(encoding="utf-8")
    source = (ROOT / "frontend" / "src" / "lib" / "i18n.ts").read_text(encoding="utf-8")
    block = source[source.index("  kn: {"):source.index("export function t")]
    strings = re.findall(r"^\s+\w+: '(.*)',$", block, flags=re.M)
    assert len(strings) > 100
    for text in strings:
        assert text in doc, text


# ── Repo files ───────────────────────────────────────────────────────────────

def test_page_title():
    assert "<title>Kelasa Mitra</title>" in (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")


def test_gitignore_has_no_powershell_leftovers():
    lines = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert ".env" in lines
    assert not [line for line in lines if '"@' in line or '@"' in line or "Set-Content" in line]


def test_env_file_is_ignored():
    result = subprocess.run(["git", "check-ignore", "backend/.env"], cwd=ROOT,
                            capture_output=True, text=True)
    assert result.returncode == 0
