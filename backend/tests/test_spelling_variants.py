"""
Speech engines spell English loanwords in Devanagari and Kannada in several ways. Matching
normalises both the text and the synonyms, accepts listed spelling variants, and tolerates one
letter for long loanwords. These tests also guard against false positives and collisions, and
check the 13 samples and 15 evaluation inputs give exactly the same results as before.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import tools.fallback as fb  # noqa: E402
from tools.fallback import extract_profile_fallback, normalize_for_match  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

TESTS = BACKEND / "tests"

# From the owner's report (Android Chrome, Hindi picker). The exact phone text was not pasted,
# so this transcription may differ in code points from what the phone produced.
PHONE_SENTENCE = "मैं एक इलेक्ट्रिशियन हूं और मुझे 3 साल का एक्सपीरियंस है व्हाइटफील्ड"

SPELLINGS = [
    ("hi", "इलेक्ट्रिशियन", "electrician"), ("hi", "इलेक्ट्रीशियन", "electrician"),
    ("hi", "इलेक्ट्रीशन", "electrician"), ("hi", "इलेक्ट्रिशन", "electrician"),
    ("hi", "ड्राइवर", "driver_car"), ("hi", "ड्राईवर", "driver_car"), ("hi", "ड्रायवर", "driver_car"),
    ("hi", "प्लंबर", "plumber"), ("hi", "प्लम्बर", "plumber"),
    ("hi", "डिलीवरी", "delivery"), ("hi", "डिलिवरी", "delivery"),
    ("hi", "सिक्योरिटी गार्ड", "security_guard"), ("hi", "सिक्युरिटी गार्ड", "security_guard"),
    ("hi", "हाउसकीपिंग", "housekeeping"), ("hi", "हाउस कीपिंग", "housekeeping"),
    ("kn", "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್", "electrician"), ("kn", "ಎಲೆಕ್ಟ್ರೀಷಿಯನ್", "electrician"),
    ("kn", "ಎಲೆಕ್ಟ್ರಿಶಿಯನ್", "electrician"),
    ("kn", "ಡ್ರೈವರ್", "driver_car"), ("kn", "ಡ್ರೈವರು", "driver_car"),
    ("kn", "ಪ್ಲಂಬರ್", "plumber"), ("kn", "ಪ್ಲಮ್ಬರ್", "plumber"),
    ("kn", "ಡೆಲಿವರಿ", "delivery"), ("kn", "ಡೆಲಿವರೀ", "delivery"),
    ("kn", "ಸೆಕ್ಯೂರಿಟಿ ಗಾರ್ಡ್", "security_guard"), ("kn", "ಸೆಕ್ಯುರಿಟಿ ಗಾರ್ಡ್", "security_guard"),
    ("kn", "ಹೌಸ್‌ಕೀಪಿಂಗ್", "housekeeping"), ("kn", "ಹೌಸ್ ಕೀಪಿಂಗ್", "housekeeping"),
]


def test_the_phone_sentence_now_finds_the_electrician():
    result = extract_profile_fallback(PHONE_SENTENCE, "hi")
    assert result["skills"] == ["electrician"]
    assert result["area"]["id"] == "whitefield"
    assert result["experience_years"] == 3.0


def test_the_cause_was_one_vowel_sign():
    """The phone wrote short i (U+093F) where the synonym list has long ii (U+0940)."""
    phone, listed = "इलेक्ट्रिशियन", "इलेक्ट्रीशियन"
    assert phone != listed and [c for c, d in zip(phone, listed) if c != d] == ["ि"]
    assert normalize_for_match(phone) == normalize_for_match(listed)


@pytest.mark.parametrize("lang,word,skill", SPELLINGS)
def test_spelling_variants_match_alone_and_in_a_sentence(lang, word, skill):
    frame = f"मैं {word} हूं" if lang == "hi" else f"ನಾನು {word} ಆಗಿದ್ದೆ"
    assert extract_profile_fallback(word, lang)["skills"] == [skill]
    assert extract_profile_fallback(frame, lang)["skills"] == [skill]


# ── Normalisation ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("a,b", [
    ("इलेक्ट्रिशियन", "इलेक्ट्रीशियन"),      # i / ii sign
    ("कुक", "कूक"),                          # u / uu sign
    ("ईंट", "इंट"),                           # independent ii / i
    ("हूँ", "हूं"),                            # chandrabindu / anusvara
    ("प्लम्बर", "प्लंबर"),                      # half nasal / anusvara
    ("ड़़", "ड़"),                        # stray nukta
    ("क़", "क"),                    # क़ (precomposed) / क
    ("ಹೌಸ್‌ಕೀಪಿಂಗ್", "ಹೌಸ್ಕೀಪಿಂಗ್"),       # ZWNJ removed
    ("ಡೆಲಿವರೀ", "ಡೆಲಿವರಿ"),                 # Kannada ii / i
    ("ಸೆಕ್ಯೂರಿಟಿ", "ಸೆಕ್ಯುರಿಟಿ"),           # Kannada uu / u
    ("ಹೋಟೆಲ್", "ಹೊಟೆಲ್"),                   # Kannada long / short o
    ("ಪ್ಲಮ್ಬರ್", "ಪ್ಲಂಬರ್"),                  # Kannada half nasal / anusvara
])
def test_equivalent_spellings_normalise_equal(a, b):
    assert normalize_for_match(a) == normalize_for_match(b)


def test_english_is_only_lowercased():
    assert normalize_for_match("Hotel Helper") == "hotel helper"


def test_what_the_worker_sees_is_never_changed():
    text = "मैं इलेक्ट्रिशियन हूँ, ವೈಟ್‌ಫೀಲ್ಡ್"
    assert extract_profile(text, ui_language="hi").raw_input == text


# ── Conservative fuzzy matching ──────────────────────────────────────────────

def test_one_letter_variant_of_a_long_loanword_matches():
    assert extract_profile_fallback("मैं इलेक्ट्रिसियन हूं", "hi")["skills"] == ["electrician"]


def test_short_words_are_never_fuzzy_matched():
    # "कुक" (cook) is 3 code points: a one-letter change must not match anything.
    assert fb._fuzzy_skills(normalize_for_match("कुच")) == []
    assert extract_profile_fallback("मैं कुच हूँ", "hi")["skills"] == []


def test_fuzzy_needs_exactly_one_skill_within_one_edit(monkeypatch):
    monkeypatch.setattr(fb, "_FUZZY_WORDS", {"abcdefg": {"x"}, "abcdefh": {"y"}})
    assert fb._fuzzy_skills("abcdefz") == []  # within one edit of two skills: ambiguous
    monkeypatch.setattr(fb, "_FUZZY_WORDS", {"अबकडइफग": {"x"}})
    assert fb._fuzzy_skills("अबकडइफज") == ["x"]


def test_fuzzy_only_targets_loanword_skills():
    assert set(fb._FUZZY_SKILLS) == {"electrician", "driver_car", "plumber", "delivery", "security_guard",
                                     "housekeeping", "hotel_helper", "two_wheeler", "tailoring", "cook"}
    assert all(skills <= fb._FUZZY_SKILLS for skills in fb._FUZZY_WORDS.values())
    assert all(len(word) >= fb._FUZZY_MIN_LEN and not word.isascii() for word in fb._FUZZY_WORDS)


@pytest.mark.parametrize("a,b,ok", [
    ("abcdef", "abcdef", True), ("abcdef", "abcdeg", True), ("abcdef", "abcdefg", True),
    ("abcdef", "abdef", True), ("abcdef", "abcfed", False), ("abcdef", "abcdefgh", False),
])
def test_edit_distance_one(a, b, ok):
    assert fb._within_one_edit(a, b) is ok


# ── No false positives ───────────────────────────────────────────────────────

NO_SKILL = json.loads((TESTS / "no_skill_sentences.json").read_text(encoding="utf-8"))
NO_SKILL_CASES = [(lang, s) for lang in ("en", "hi", "kn") for s in NO_SKILL[lang]]


def test_there_are_at_least_60_no_skill_sentences():
    assert len(NO_SKILL_CASES) >= 60
    for word in ("teacher", "doctor", "student", "engineer", "nurse", "shopkeeper", "farmer"):
        assert any(word in s for s in NO_SKILL["en"]), word


@pytest.mark.parametrize("lang,sentence", NO_SKILL_CASES)
def test_sentence_matches_no_skill(lang, sentence):
    assert extract_profile(sentence, ui_language=lang).skills == []


# ── No collisions after normalisation ────────────────────────────────────────

# Overlaps already in skills.json before normalisation existed (watchman / security guard,
# sweeping, मजदूर). They are listed here so any NEW shared term fails this test.
KNOWN_SHARED = {
    "sweeping": {"housekeeping", "sanitation"},
    "watchman": {"security_guard", "watchman"},
    "night guard": {"security_guard", "watchman"},
    normalize_for_match("ಕಾವಲುಗಾರ"): {"security_guard", "watchman"},
    normalize_for_match("चौकीदार"): {"security_guard", "watchman"},
    normalize_for_match("मजदूर"): {"construction_helper", "factory_worker"},
}


def test_no_two_skills_share_a_synonym_after_normalisation():
    owners: dict[str, set[str]] = {}
    for skill in fb._SKILLS:
        for idx, synonyms in enumerate((skill["synonyms_en"], skill["synonyms_kn"], skill["synonyms_hi"])):
            for syn in synonyms:
                key = syn.lower().strip()
                if key in fb._AMBIGUOUS_TERMS:
                    continue
                for term in {key, *fb._stems_for(key, is_kn=idx == 1, is_hi=idx == 2)}:
                    owners.setdefault(normalize_for_match(term), set()).add(skill["id"])
    shared = {term: ids for term, ids in owners.items() if len(ids) > 1}
    assert shared == KNOWN_SHARED


# ── Same results as before for the samples and the evaluation inputs ─────────

BASELINE = json.loads((TESTS / "extraction_baseline.json").read_text(encoding="utf-8"))


def _inputs():
    samples = json.loads((TESTS / "samples.json").read_text(encoding="utf-8"))
    evals = json.loads((TESTS / "eval_samples.json").read_text(encoding="utf-8"))["samples"]
    return ([(f"sample-{s['id']}", s["input"], s["ui_language"]) for s in samples]
            + [(f"eval-{s['id']}", s["input"], s["language"]) for s in evals])


@pytest.mark.parametrize("name,text,lang", _inputs(), ids=[i[0] for i in _inputs()])
def test_samples_and_eval_inputs_are_unchanged(name, text, lang):
    p = extract_profile(text, ui_language=lang)
    got = {"skills": p.skills, "area": p.area.id if p.area else None,
           "experience_years": p.experience_years, "languages": p.languages}
    assert got == BASELINE[name]
