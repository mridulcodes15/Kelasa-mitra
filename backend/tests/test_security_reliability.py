"""
Fixes for static-analysis findings: regexes without catastrophic backtracking, a bound on
input size, CORS limited to known origins, https-only Orchestrate URLs, and a safe parser for
model output. No network.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import main  # noqa: E402
import tools.orchestrate_client as oc  # noqa: E402
from routers.profile import MAX_TEXT_CHARS  # noqa: E402
from tools.fallback import _EXP_PATTERN, _parse_experience  # noqa: E402
from tools.provider import _parse_llm_json  # noqa: E402

FAST_S = 0.5


def _seconds(fn, *args) -> float:
    start = time.perf_counter()
    fn(*args)
    return time.perf_counter() - start


# ── Regular expressions: linear time on hostile input ────────────────────────

def test_word_number_experience_pattern_is_fast_on_a_long_word():
    # Was cubic: 800 letters took 5.7 s.
    assert _seconds(_parse_experience, "one " + "a" * 5000) < FAST_S


def test_numeric_experience_pattern_is_fast_on_a_long_number():
    # Was quadratic: 20,000 digits took 18 s.
    assert _seconds(_EXP_PATTERN.search, "1" * 50_000) < FAST_S


@pytest.mark.parametrize("text,years", [
    ("I am a cook, 2 years", 2.0),
    ("driver for 3.5 yrs", 3.5),
    ("two years as a cook", 2),
    ("worked for three more years", 3),
    ("five years of experience", 5),
    ("ನಾನು 4 ವರ್ಷ ಅಡುಗೆ ಮಾಡಿದ್ದೇನೆ", 4.0),
    ("मैंने 6 साल काम किया", 6.0),
    ("दो साल का अनुभव", 2),
    ("I am a cook", None),
    ("flat 12B, 3 floors", None),
])
def test_experience_parsing_still_works(text, years):
    assert _parse_experience(text) == years


def test_number_inside_a_longer_number_is_not_split():
    assert _parse_experience("call 98450 years ago") == 98450.0
    assert _parse_experience("version 1.5 years") == 1.5


# ── Input size ───────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return TestClient(main.app)


def test_extract_profile_rejects_text_over_the_limit(client):
    too_long = client.post("/api/profile/extract-profile", json={"text": "a" * (MAX_TEXT_CHARS + 1)})
    assert too_long.status_code == 422
    at_limit = client.post("/api/profile/extract-profile", json={"text": "cook " * (MAX_TEXT_CHARS // 5)})
    assert at_limit.status_code == 200


def test_extract_profile_limit_matches_agent_chat():
    from routers.agent import AgentChatRequest
    assert AgentChatRequest.model_fields["text"].metadata[0].max_length == MAX_TEXT_CHARS


# ── CORS ─────────────────────────────────────────────────────────────────────

def _preflight(client, origin: str):
    return client.options("/api/matches", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })


def test_cors_allows_the_local_dev_server(client):
    response = _preflight(client, "http://localhost:5173")
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_does_not_allow_other_origins(client):
    response = _preflight(client, "https://evil.example")
    assert "access-control-allow-origin" not in response.headers
    simple = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers


def test_cors_never_uses_a_wildcard(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "*")
    assert "*" not in main.cors_origins()
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", " https://a.example , *, https://b.example ")
    assert main.cors_origins() == ["https://a.example", "https://b.example"]
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS")
    assert main.cors_origins() == list(main.DEFAULT_CORS_ORIGINS)


# ── Orchestrate settings: https only ─────────────────────────────────────────

SAFE = {
    "ORCHESTRATE_INSTANCE_URL": "https://orchestrate.test/instances/abc",
    "ORCHESTRATE_API_KEY": "fake-test-key-not-real",
    "ORCHESTRATE_AGENT_ID": "0b7c1d2e-agent_1",
}


@pytest.fixture
def env(monkeypatch):
    for name in ("ORCHESTRATE_AUTH_TYPE", "ORCHESTRATE_IAM_URL"):
        monkeypatch.delenv(name, raising=False)
    for name, value in SAFE.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


def test_https_settings_are_accepted(env):
    assert oc.load_settings() is not None


@pytest.mark.parametrize("name,value", [
    ("ORCHESTRATE_INSTANCE_URL", "http://orchestrate.test/instances/abc"),
    ("ORCHESTRATE_INSTANCE_URL", "orchestrate.test/instances/abc"),
    ("ORCHESTRATE_INSTANCE_URL", "https:///no-host"),
    ("ORCHESTRATE_IAM_URL", "http://iam.test/identity/token"),
    ("ORCHESTRATE_AGENT_ID", "abc/../../admin"),
    ("ORCHESTRATE_AGENT_ID", "abc?x=1"),
])
def test_unsafe_settings_disable_the_agent(env, name, value, caplog):
    env.setenv(name, value)
    assert oc.load_settings() is None
    assert SAFE["ORCHESTRATE_API_KEY"] not in caplog.text
    assert value not in caplog.text


# ── Model output parsing ─────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ('{"skills": ["cook"]}', {"skills": ["cook"]}),
    ('```json\n{"skills": ["cook"]}\n```', {"skills": ["cook"]}),
    ('```\n{"area": "Whitefield"}\n```', {"area": "Whitefield"}),
    ('  {"a": 1}  ', {"a": 1}),
    ("not json", None),
    ("[1, 2]", None),
    ("```json\n```", None),
])
def test_parse_llm_json(raw, expected):
    assert _parse_llm_json(raw) == expected


def test_parse_llm_json_is_fast_on_long_whitespace():
    assert _seconds(_parse_llm_json, " " * 100_000 + "x") < FAST_S
