"""
The picker language decides the reply language on every path: extraction, matches, skill gap,
the rules answer of /api/agent/chat, and the text the Orchestrate tools hand to the agent.
No network: the Orchestrate client is not configured here, and the tool package is run locally.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import tools.orchestrate_client as oc  # noqa: E402
from main import app  # noqa: E402
from tools.follow_up import follow_up  # noqa: E402
from tools.orchestrate_client import agent_message  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

ORCHESTRATE_VARS = ("ORCHESTRATE_INSTANCE_URL", "ORCHESTRATE_API_KEY", "ORCHESTRATE_AGENT_ID",
                    "ORCHESTRATE_IAM_URL", "ORCHESTRATE_AUTH_TYPE")
LANGS = ("en", "kn", "hi")
# The same worker in three scripts; the picker, not the script, must decide the reply language.
TEXTS = {
    "en": "I am a cook in Whitefield, 3 years",
    "kn": "ನಾನು ವೈಟ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಅಡುಗೆಯವನು, 3 ವರ್ಷ",
    "hi": "मैं व्हाइटफील्ड में कुक हूँ, 3 साल",
}


def script_of(text: str) -> str:
    """kn / hi / en by the script of the letters (same ranges as tools/fallback.py)."""
    kn = sum("ಀ" <= ch <= "೿" for ch in text)
    hi = sum("ऀ" <= ch <= "ॿ" for ch in text)
    if kn > hi and kn:
        return "kn"
    if hi:
        return "hi"
    return "en"


@pytest.fixture(autouse=True)
def no_orchestrate(monkeypatch):
    for name in ORCHESTRATE_VARS:
        monkeypatch.setenv(name, "")
    monkeypatch.setattr(oc, "_CLIENT", None)
    monkeypatch.setattr(oc, "_TRANSPORT", None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.parametrize("picker", LANGS)
@pytest.mark.parametrize("written_in", LANGS)
def test_extraction_takes_the_picker_language(picker, written_in, client):
    body = client.post("/api/profile/extract-profile",
                       json={"text": TEXTS[written_in], "ui_language": picker}).json()
    assert body["detected_language"] == picker


@pytest.mark.parametrize("picker", LANGS)
def test_match_reasons_and_skill_gap_text_are_in_the_picker_language(picker, client):
    profile = extract_profile(TEXTS["en"], ui_language=picker).model_dump()
    matches = client.post("/api/matches", json={"profile": profile}).json()["matches"]
    assert matches
    assert {script_of(m["reason"]) for m in matches} == {picker}
    gaps = client.post("/api/skill-gap", json={"profile": profile}).json()["gaps"]
    assert gaps
    assert {script_of(g["explanation"]) for g in gaps} == {picker}


@pytest.mark.parametrize("picker", LANGS)
def test_follow_up_question_is_in_the_picker_language(picker, client):
    profile = extract_profile("I am a cook", ui_language=picker).model_dump()
    body = client.post("/api/matches", json={"profile": profile}).json()
    assert body["follow_up_question"] == follow_up("no_area", picker)
    assert script_of(body["follow_up_question"]) == picker


@pytest.mark.parametrize("picker", LANGS)
def test_rules_answer_of_agent_chat_is_in_the_picker_language(picker, client):
    body = client.post("/api/agent/chat", json={"text": "I am a cook", "ui_language": picker}).json()
    assert body["source"] == "rules" and body["reason"] == "not_configured"
    assert body["reply"] == follow_up("no_area", picker)


@pytest.mark.parametrize("picker", LANGS)
def test_agent_receives_the_picker_language(picker):
    assert agent_message(TEXTS["en"], picker).splitlines()[0] == f"ui_language: {picker}"


RUNNER = r"""
import json, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, sys.argv[1])
import kelasa_core
out = {}
text = sys.stdin.read()
for lang in ("en", "kn", "hi"):
    out[lang] = {
        "matches": kelasa_core.find_matches_result(text, lang)["reply_lines"],
        "gaps": kelasa_core.skill_gap_result(text, lang)["reply_lines"],
        "follow_up": kelasa_core.extract_profile_result("I am a cook", lang)["follow_up_question"],
    }
print(json.dumps(out, ensure_ascii=False))
"""


def test_tool_package_reply_lines_are_in_the_requested_language():
    """The agent path: the Orchestrate tools write reply_lines in ui_language for English input."""
    package = ROOT / "orchestrate" / "kelasa_tools"
    if not package.exists():
        pytest.skip("orchestrate/kelasa_tools has not been built")
    result = subprocess.run([sys.executable, "-I", "-c", RUNNER, str(package)], input=TEXTS["en"],
                            capture_output=True, text=True, encoding="utf-8", check=True)
    out = json.loads(result.stdout)
    for lang in LANGS:
        lines = out[lang]["matches"] + out[lang]["gaps"]
        assert lines, lang
        assert {script_of(line) for line in lines} == {lang}, lang
        assert script_of(out[lang]["follow_up"]) == lang
