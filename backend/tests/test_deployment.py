"""
Single-service deployment: FastAPI serves the built frontend next to /api, and the public
endpoints have a per-client rate limit. No network.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import main  # noqa: E402
import tools.orchestrate_client as oc  # noqa: E402
from tools.rate_limit import AGENT_LIMITER, EXTRACT_LIMITER, MAX_TRACKED_CLIENTS, RateLimiter  # noqa: E402

ORCHESTRATE_VARS = ("ORCHESTRATE_INSTANCE_URL", "ORCHESTRATE_API_KEY", "ORCHESTRATE_AGENT_ID",
                    "ORCHESTRATE_IAM_URL", "ORCHESTRATE_AUTH_TYPE")


@pytest.fixture(autouse=True)
def rules_only(monkeypatch):
    """Like the deployment: Orchestrate and Groq unset, so nothing leaves the process."""
    for name in ORCHESTRATE_VARS + ("CORS_ALLOWED_ORIGINS",):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(oc, "_CLIENT", None)
    monkeypatch.setattr(oc, "_TRANSPORT", None)


# ── Serving the built frontend ───────────────────────────────────────────────

@pytest.fixture
def dist(tmp_path) -> Path:
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text("<!doctype html><title>Kelasa Mitra</title>", encoding="utf-8")
    (root / "assets" / "app.js").write_text("console.log('app')", encoding="utf-8")
    (root / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("outside dist", encoding="utf-8")
    return root


def _site(dist_dir: Path) -> tuple[TestClient, bool]:
    app = FastAPI()

    @app.post("/api/echo")
    def echo() -> dict[str, str]:
        return {"ok": "yes"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    mounted = main.mount_frontend(app, dist_dir)
    return TestClient(app), mounted


def test_serves_index_and_assets(dist):
    client, mounted = _site(dist)
    assert mounted
    home = client.get("/")
    assert home.status_code == 200 and "Kelasa Mitra" in home.text
    assert home.headers["content-type"].startswith("text/html")
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200 and "javascript" in asset.headers["content-type"]
    assert client.get("/favicon.svg").headers["content-type"].startswith("image/svg")


def test_unknown_page_paths_fall_back_to_index(dist):
    client, _ = _site(dist)
    assert "Kelasa Mitra" in client.get("/jobs").text
    assert "Kelasa Mitra" in client.get("/some/deep/link").text


def test_api_routes_are_unchanged_and_unknown_api_paths_are_not_html(dist):
    client, _ = _site(dist)
    assert client.post("/api/echo").json() == {"ok": "yes"}
    assert client.get("/health").json() == {"status": "ok"}
    missing = client.get("/api/nope")
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/json")
    assert client.get("/api").status_code == 404


@pytest.mark.parametrize("path", ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"])
def test_files_outside_dist_are_never_served(dist, path):
    client, _ = _site(dist)
    response = client.get(path)
    assert "outside dist" not in response.text


def test_nothing_is_mounted_without_a_build(tmp_path):
    client, mounted = _site(tmp_path / "no-dist")
    assert not mounted
    assert client.get("/").status_code == 404
    assert client.post("/api/echo").status_code == 200


# ── The real app, rules only ─────────────────────────────────────────────────

@pytest.fixture
def client():
    return TestClient(main.app)


def test_real_api_works_same_origin_without_cors_settings(client):
    """A page served by this app calls /api on the same origin: no Origin header, no CORS needed."""
    profile = client.post("/api/profile/extract-profile", json={"text": "I am a cook in Whitefield", "ui_language": "en"})
    assert profile.status_code == 200
    matches = client.post("/api/matches", json={"profile": profile.json()})
    assert matches.status_code == 200 and matches.json()["matches"]
    assert client.get("/health").json() == {"status": "ok"}


def test_agent_chat_answers_from_the_rules_and_calls_nothing(client, monkeypatch):
    def no_network(*_, **__):
        raise AssertionError("tried to reach Orchestrate")
    monkeypatch.setattr(oc.OrchestrateClient, "chat", no_network)
    body = client.post("/api/agent/chat", json={"text": "I am a cook", "ui_language": "kn"}).json()
    assert body["source"] == "rules" and body["reason"] == "not_configured"


# ── Rate limits ──────────────────────────────────────────────────────────────

class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_limiter_allows_up_to_the_limit_then_waits_out_the_window():
    clock = FakeClock()
    limiter = RateLimiter(limit=3, window_s=60, clock=clock)
    assert [limiter.check("a") for _ in range(3)] == [0.0, 0.0, 0.0]
    clock.now += 10
    assert limiter.check("a") == pytest.approx(50)
    assert limiter.check("b") == 0.0  # another client is not affected
    clock.now += 50
    assert limiter.check("a") == 0.0


def test_limiter_memory_is_bounded():
    limiter = RateLimiter(limit=1)
    for i in range(MAX_TRACKED_CLIENTS + 50):
        limiter.check(f"10.0.{i // 256}.{i % 256}")
    assert len(limiter._hits) == MAX_TRACKED_CLIENTS


@pytest.mark.parametrize("path,body,limiter", [
    ("/api/profile/extract-profile", {"text": "I am a cook", "ui_language": "en"}, EXTRACT_LIMITER),
    ("/api/agent/chat", {"text": "I am a cook", "ui_language": "en"}, AGENT_LIMITER),
])
def test_endpoint_returns_429_with_retry_after(client, path, body, limiter):
    for _ in range(limiter.limit):
        assert client.post(path, json=body).status_code == 200
    blocked = client.post(path, json=body)
    assert blocked.status_code == 429
    assert 1 <= int(blocked.headers["retry-after"]) <= 60
    assert "Too many requests" in blocked.json()["detail"]


def test_other_endpoints_are_not_limited(client):
    for _ in range(EXTRACT_LIMITER.limit + 5):
        assert client.get("/health").status_code == 200


def test_limits_are_sensible():
    assert EXTRACT_LIMITER.limit == 30 and AGENT_LIMITER.limit == 10
    assert EXTRACT_LIMITER.window_s == AGENT_LIMITER.window_s == 60
