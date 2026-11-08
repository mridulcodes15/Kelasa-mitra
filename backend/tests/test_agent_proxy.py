"""POST /api/agent/chat: token caching, timeout, and the rules fallback, with no real network."""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import tools.orchestrate_client as oc  # noqa: E402
from main import app  # noqa: E402

FAKE_KEY = "fake-test-key-not-real"
FAKE_TOKEN = "fake-test-token-not-real"
ENV = {
    "ORCHESTRATE_INSTANCE_URL": "https://orchestrate.test/instances/abc",
    "ORCHESTRATE_API_KEY": FAKE_KEY,
    "ORCHESTRATE_AGENT_ID": "agent-123",
    "ORCHESTRATE_IAM_URL": "https://iam.test/identity/token",
    "ORCHESTRATE_AUTH_TYPE": "ibm_iam",
}
COOK_KORAMANGALA = "I am a cook in Koramangala"


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(oc, "_CLIENT", None)
    monkeypatch.setattr(oc, "_TRANSPORT", None)


@pytest.fixture
def client():
    return TestClient(app)


def configure(monkeypatch, handler):
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)
    calls = {"token": 0, "chat": 0, "chat_requests": []}

    def wrapped(request: httpx.Request) -> httpx.Response:
        if request.url.host == "iam.test":
            calls["token"] += 1
            assert FAKE_KEY in request.content.decode()
            return httpx.Response(200, json={"access_token": FAKE_TOKEN, "expires_in": 3600})
        calls["chat"] += 1
        calls["chat_requests"].append(request)
        return handler(request)

    monkeypatch.setattr(oc, "_TRANSPORT", httpx.MockTransport(wrapped))
    return calls


def ok_reply(text="Kitchen Assistant: reason", thread="thread-1"):
    return lambda request: httpx.Response(200, json={
        "id": "00000000-0000-0000-0000-000000000000", "object": "chat.completion", "created": 1,
        "model": "m", "thread_id": thread,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}}],
    })


# ── No credentials: the fallback ─────────────────────────────────────────────

@pytest.mark.parametrize("text,lang,question", [
    ("I am a cook", "en", "Where in Bengaluru do you live?"),
    ("ನಾನು ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ", "kn", "ನೀವು ಬೆಂಗಳೂರಿನ ಯಾವ ಭಾಗದಲ್ಲಿ"),
    ("मैं खाना बनाना जानती हूँ", "hi", "आप बेंगलुरु के किस इलाके में"),
])
def test_without_credentials_rules_ask_the_follow_up(client, text, lang, question):
    body = client.post("/api/agent/chat", json={"text": text, "ui_language": lang}).json()
    assert body["source"] == "rules"
    assert body["reason"] == "not_configured"
    assert body["reply"].startswith(question)


def test_without_credentials_complete_profile_has_no_reply(client):
    body = client.post("/api/agent/chat", json={"text": COOK_KORAMANGALA, "ui_language": "en"}).json()
    assert body == {"source": "rules", "reply": None, "reason": "not_configured", "thread_id": None}


def test_partial_credentials_count_as_not_configured(client, monkeypatch):
    monkeypatch.setenv("ORCHESTRATE_INSTANCE_URL", ENV["ORCHESTRATE_INSTANCE_URL"])
    monkeypatch.setenv("ORCHESTRATE_AGENT_ID", ENV["ORCHESTRATE_AGENT_ID"])
    body = client.post("/api/agent/chat", json={"text": "hi", "ui_language": "en"}).json()
    assert body["reason"] == "not_configured"


# ── With (fake) credentials ──────────────────────────────────────────────────

def test_agent_reply_is_returned(client, monkeypatch):
    calls = configure(monkeypatch, ok_reply())
    body = client.post("/api/agent/chat", json={"text": COOK_KORAMANGALA, "ui_language": "kn"}).json()
    assert body == {"source": "agent", "reply": "Kitchen Assistant: reason", "reason": None,
                    "thread_id": "thread-1"}
    request = calls["chat_requests"][0]
    assert request.url.path == "/instances/abc/v1/orchestrate/agent-123/chat/completions"
    assert request.headers["authorization"] == f"Bearer {FAKE_TOKEN}"
    sent = json.loads(request.content)
    assert sent["stream"] is False
    assert sent["messages"] == [{"role": "user",
                                 "content": f"ui_language: kn\nworker_text: {COOK_KORAMANGALA}"}]


def test_token_is_cached_between_requests(client, monkeypatch):
    calls = configure(monkeypatch, ok_reply())
    for _ in range(3):
        client.post("/api/agent/chat", json={"text": COOK_KORAMANGALA, "ui_language": "en"})
    assert calls == {**calls, "token": 1, "chat": 3}


def test_token_is_refreshed_after_expiry(monkeypatch):
    configure(monkeypatch, ok_reply())
    now = [1000.0]
    agent = oc.OrchestrateClient(oc.load_settings(), clock=lambda: now[0])
    first = agent._get_token(deadline=now[0] + 20)
    now[0] += 3600
    assert agent._get_token(deadline=now[0] + 20) == first  # fake IAM always issues the same token
    assert agent._token_expires_at > now[0]


def test_unsupported_language_is_sent_as_english(client, monkeypatch):
    calls = configure(monkeypatch, ok_reply())
    client.post("/api/agent/chat", json={"text": COOK_KORAMANGALA, "ui_language": "zz"})
    assert json.loads(calls["chat_requests"][0].content)["messages"][0]["content"].startswith("ui_language: en\n")


@pytest.mark.parametrize("content,expected", [
    ([{"response_type": "text", "text": "line one"}, {"response_type": "text", "text": "line two"}],
     "line one\nline two"),
    ("  plain text  ", "plain text"),
])
def test_reply_shapes(client, monkeypatch, content, expected):
    configure(monkeypatch, lambda r: httpx.Response(200, json={
        "thread_id": "t", "choices": [{"message": {"content": content}}]}))
    assert client.post("/api/agent/chat", json={"text": "x", "ui_language": "en"}).json()["reply"] == expected


# ── Failures fall back to rules ──────────────────────────────────────────────

def raise_timeout(request):
    raise httpx.ReadTimeout("slow", request=request)


@pytest.mark.parametrize("handler,reason", [
    (raise_timeout, "timeout"),
    (lambda r: httpx.Response(500, text="boom"), "agent_http_error"),
    (lambda r: httpx.Response(404, json={"detail": "agent not found"}), "agent_http_error"),
    (lambda r: httpx.Response(200, json={"choices": []}), "unexpected_response"),
    (lambda r: httpx.Response(200, text="not json"), "unexpected_response"),
    (lambda r: httpx.Response(200, json={"choices": [{"message": {"content": ""}}]}), "empty_reply"),
])
def test_agent_failures_fall_back_to_rules(client, monkeypatch, handler, reason):
    configure(monkeypatch, handler)
    body = client.post("/api/agent/chat", json={"text": "I am a cook", "ui_language": "hi"}).json()
    assert body["source"] == "rules"
    assert body["reason"] == reason
    assert body["reply"].startswith("आप बेंगलुरु")


def test_rejected_key_falls_back(client, monkeypatch):
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(oc, "_TRANSPORT", httpx.MockTransport(lambda r: httpx.Response(400, json={"errorCode": "BXNIM0415E"})))
    body = client.post("/api/agent/chat", json={"text": "I am a cook", "ui_language": "en"}).json()
    assert (body["source"], body["reason"]) == ("rules", "token_rejected")


def test_unauthorised_chat_forgets_the_token(client, monkeypatch):
    calls = configure(monkeypatch, lambda r: httpx.Response(401, json={"detail": "expired"}))
    client.post("/api/agent/chat", json={"text": "x", "ui_language": "en"})
    client.post("/api/agent/chat", json={"text": "x", "ui_language": "en"})
    assert calls["token"] == 2


def test_timeout_budget_is_about_20_seconds():
    assert oc.DEFAULT_TIMEOUT_S == 20.0


# ── Secrets never leave the server ───────────────────────────────────────────

@pytest.mark.parametrize("handler", [ok_reply(), raise_timeout, lambda r: httpx.Response(500, text="boom")])
def test_key_and_token_never_in_response_or_logs(client, monkeypatch, caplog, handler):
    configure(monkeypatch, handler)
    with caplog.at_level(logging.DEBUG):
        response = client.post("/api/agent/chat", json={"text": "I am a cook", "ui_language": "en"})
    for secret in (FAKE_KEY, FAKE_TOKEN):
        assert secret not in response.text
        assert secret not in caplog.text


def test_settings_repr_hides_the_key(monkeypatch):
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)
    assert FAKE_KEY not in repr(oc.load_settings())


def test_route_is_in_openapi(client):
    assert "/api/agent/chat" in client.get("/openapi.json").json()["paths"]
