"""
How /api/agent/chat gets its token: it must match the ADK for each host and key type, and
the server's error must reach agent_warmup.py without the key or token. No real network.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import subprocess
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

AWS_URL = "https://api.ap-south-1.dl.watson-orchestrate.ibm.com/instances/test-instance"
CLOUD_URL = "https://api.au-syd.watson-orchestrate.cloud.ibm.com/instances/test-instance"
K1_KEY = base64.b64encode(b"k1:fake-identity:fake-secret").decode()
K2_KEY = base64.b64encode(b"k2:fake-identity:fake-secret").decode()
PLAIN_KEY = "fake-plain-key-not-mcsp"


def fake_jwt(lifetime: int = 7200) -> str:
    import time
    claims = {"exp": int(time.time()) + lifetime, "iat": int(time.time())}
    part = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"eyJhbGciOiJub25lIn0.{part}.sig"


TOKEN = fake_jwt()

ALL_VARS = ("ORCHESTRATE_INSTANCE_URL", "ORCHESTRATE_API_KEY", "ORCHESTRATE_AGENT_ID",
            "ORCHESTRATE_AUTH_TYPE", "ORCHESTRATE_IAM_URL")


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    for name in ALL_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(oc, "_CLIENT", None)
    monkeypatch.setattr(oc, "_TRANSPORT", None)


def setup(monkeypatch, url, key, token_handler, auth_type=""):
    monkeypatch.setenv("ORCHESTRATE_INSTANCE_URL", url)
    monkeypatch.setenv("ORCHESTRATE_API_KEY", key)
    monkeypatch.setenv("ORCHESTRATE_AGENT_ID", "agent-123")
    if auth_type:
        monkeypatch.setenv("ORCHESTRATE_AUTH_TYPE", auth_type)
    seen = {"token_requests": [], "chat_auth": []}
    instance_host = httpx.URL(url).host

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == instance_host:
            seen["chat_auth"].append(request.headers.get("authorization"))
            return httpx.Response(200, json={"thread_id": "t", "choices": [{"message": {"content": "ok"}}]})
        seen["token_requests"].append(request)
        return token_handler(request)

    monkeypatch.setattr(oc, "_TRANSPORT", httpx.MockTransport(handler))
    return seen


def mcsp_ok(request):
    return httpx.Response(200, json={"token": TOKEN, "token_type": "jwt"})


def ask():
    return TestClient(app).post("/api/agent/chat", json={"text": "I am a cook in Koramangala",
                                                          "ui_language": "en"}).json()


# ── Which method, for which host and key (same rules as the ADK) ─────────────

@pytest.mark.parametrize("url,key,auth,plan", [
    (CLOUD_URL, PLAIN_KEY, "", ["ibm_iam"]),
    (AWS_URL, K1_KEY, "", ["mcsp_v1"]),
    (AWS_URL, K2_KEY, "", ["mcsp_v2"]),
    (AWS_URL, PLAIN_KEY, "", ["mcsp_v1", "mcsp_v2"]),
    (AWS_URL, K2_KEY, "ibm_iam", ["ibm_iam"]),
    (CLOUD_URL, PLAIN_KEY, "mcsp", ["mcsp_v1", "mcsp_v2"]),
])
def test_auth_plan_matches_adk_inference(url, key, auth, plan):
    settings = oc.AgentSettings(instance_url=url, api_key=key, agent_id="a", auth_type=auth)
    assert oc.auth_plan(settings) == plan


def test_mcsp_key_version():
    assert oc.mcsp_key_version(K1_KEY) == "k1"
    assert oc.mcsp_key_version(K2_KEY) == "k2"
    assert oc.mcsp_key_version(PLAIN_KEY) is None
    assert oc.mcsp_key_version("not base64 !!") is None


def test_aws_host_never_uses_ibm_cloud_iam(monkeypatch):
    """The failing case: an ap-south-1 .dl. host was sent to iam.cloud.ibm.com."""
    seen = setup(monkeypatch, AWS_URL, PLAIN_KEY, mcsp_ok)
    assert ask()["source"] == "agent"
    assert all(r.url.host != "iam.cloud.ibm.com" for r in seen["token_requests"])


def test_mcsp_v2_request_matches_adk(monkeypatch):
    seen = setup(monkeypatch, AWS_URL, K2_KEY, mcsp_ok)
    assert ask() == {"source": "agent", "reply": "ok", "reason": None, "thread_id": "t"}
    (request,) = seen["token_requests"]
    assert str(request.url).startswith("https://account-iam.platform.saas.ibm.com/api/2.0/apikeys/token?")
    assert request.url.params["includeRoles"] == "true"
    assert request.headers["x-api-key"] == K2_KEY
    assert request.headers["content-type"] == "application/json"
    assert json.loads(request.content) == {"apikey": K2_KEY}
    assert seen["chat_auth"] == [f"Bearer {TOKEN}"]


def test_mcsp_v1_request_matches_adk(monkeypatch):
    seen = setup(monkeypatch, AWS_URL, K1_KEY, mcsp_ok)
    assert ask()["source"] == "agent"
    (request,) = seen["token_requests"]
    assert str(request.url) == "https://iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token"
    assert json.loads(request.content) == {"apikey": K1_KEY}


def test_ibm_cloud_request_is_iam_form(monkeypatch):
    seen = setup(monkeypatch, CLOUD_URL, PLAIN_KEY,
                 lambda r: httpx.Response(200, json={"access_token": TOKEN, "expires_in": 3600}))
    assert ask()["source"] == "agent"
    (request,) = seen["token_requests"]
    assert str(request.url) == "https://iam.cloud.ibm.com/identity/token"
    assert b"grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey" in request.content


def test_unknown_key_type_falls_back_from_v1_to_v2(monkeypatch):
    def handler(request):
        if "siusermgr" in request.url.path:
            return httpx.Response(400, json={"error": "invalid key for v1"})
        return mcsp_ok(request)
    seen = setup(monkeypatch, AWS_URL, PLAIN_KEY, handler)
    assert ask()["source"] == "agent"
    assert [r.url.path for r in seen["token_requests"]] == [oc.MCSP_V1_PATH, oc.MCSP_V2_PATH]


def test_iam_url_override_is_a_base_url_for_mcsp(monkeypatch):
    monkeypatch.setenv("ORCHESTRATE_IAM_URL", "https://custom-iam.test/")
    seen = setup(monkeypatch, AWS_URL, K2_KEY, mcsp_ok)
    ask()
    assert seen["token_requests"][0].url.host == "custom-iam.test"
    assert seen["token_requests"][0].url.path == oc.MCSP_V2_PATH


def test_token_lifetime_comes_from_the_jwt(monkeypatch):
    setup(monkeypatch, AWS_URL, K2_KEY, mcsp_ok)
    client = oc.OrchestrateClient(oc.load_settings(), clock=lambda: 0.0)
    client._get_token(deadline=20.0)
    assert 6800 < client._token_expires_at < 7200 - oc.TOKEN_REFRESH_MARGIN_S + 5


# ── The server's error reaches the warm-up, without secrets ─────────────────

def test_rejected_token_keeps_server_message_without_the_key(monkeypatch):
    body = {"error": "API Key Missing or invalid", "echo": K2_KEY, "pad": "x" * 600}
    setup(monkeypatch, AWS_URL, K2_KEY, lambda r: httpx.Response(400, json=body))
    client = oc.OrchestrateClient(oc.load_settings())
    with pytest.raises(oc.AgentUnavailable) as caught:
        client.chat("x", "en")
    exc = caught.value
    assert (exc.reason, exc.status) == ("token_rejected", 400)
    assert "API Key Missing or invalid" in exc.detail
    assert exc.detail.startswith("mcsp_v2: ")
    assert K2_KEY not in exc.detail
    assert len(exc.detail) <= len("mcsp_v2: ") + oc.DETAIL_CHARS


def test_both_mcsp_failures_are_reported(monkeypatch):
    setup(monkeypatch, AWS_URL, PLAIN_KEY, lambda r: httpx.Response(400, text=f"bad {r.url.path}"))
    with pytest.raises(oc.AgentUnavailable) as caught:
        oc.OrchestrateClient(oc.load_settings()).chat("x", "en")
    assert "mcsp_v1: bad /siusermgr" in caught.value.detail
    assert "mcsp_v2: bad /api/2.0" in caught.value.detail


def test_token_response_without_token_names_only_the_keys(monkeypatch):
    setup(monkeypatch, AWS_URL, K2_KEY, lambda r: httpx.Response(200, json={"unexpected": "shape"}))
    with pytest.raises(oc.AgentUnavailable) as caught:
        oc.OrchestrateClient(oc.load_settings()).chat("x", "en")
    assert caught.value.reason == "token_missing"
    assert caught.value.detail == "mcsp_v2: response keys: unexpected"


def test_proxy_response_and_logs_never_contain_the_key(monkeypatch, caplog):
    setup(monkeypatch, AWS_URL, K2_KEY, lambda r: httpx.Response(400, text=f"bad key {K2_KEY}"))
    with caplog.at_level(logging.DEBUG):
        body = TestClient(app).post("/api/agent/chat", json={"text": "I am a cook", "ui_language": "en"})
    assert body.json()["reason"] == "token_rejected"
    assert K2_KEY not in body.text and K2_KEY not in caplog.text


def test_warmup_prints_server_error_but_not_the_key(tmp_path):
    """Run agent_warmup.py's main() with a fake transport; nothing goes to the network."""
    runner = f"""
import sys, httpx
sys.path.insert(0, {str(BACKEND)!r})
sys.argv = ["agent_warmup.py", "--timeout", "5"]
import tools.orchestrate_client as oc
oc._TRANSPORT = httpx.MockTransport(lambda r: httpx.Response(400, json={{"error": "API Key Missing", "k": "{K2_KEY}"}}))
import runpy
try:
    runpy.run_path({str(BACKEND / "scripts" / "agent_warmup.py")!r}, run_name="__main__")
except SystemExit as e:
    print("EXIT", e.code)
"""
    env = {k: v for k, v in os.environ.items() if not k.startswith("ORCHESTRATE_")}
    env.update({"ORCHESTRATE_INSTANCE_URL": AWS_URL, "ORCHESTRATE_API_KEY": K2_KEY,
                "ORCHESTRATE_AGENT_ID": "agent-123",
                # present-but-empty, so load_dotenv() cannot fill them from the owner's .env
                "ORCHESTRATE_AUTH_TYPE": "", "ORCHESTRATE_IAM_URL": "", "PYTHONIOENCODING": "utf-8",
                "PYTHONDONTWRITEBYTECODE": "1"})
    out = subprocess.run([sys.executable, "-c", runner], capture_output=True, text=True,
                         encoding="utf-8", env=env, cwd=tmp_path).stdout
    assert "Token method mcsp_v2       -> account-iam.platform.saas.ibm.com" in out
    assert "reason=token_rejected status=400" in out
    assert "API Key Missing" in out
    assert "EXIT 1" in out
    assert K2_KEY not in out
