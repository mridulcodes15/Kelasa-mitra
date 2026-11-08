"""
Server-side client for the Kelasa Mitra agent in IBM watsonx Orchestrate.

The API key stays on the server: the browser only ever talks to /api/agent/chat.
Settings come from backend/.env:
    ORCHESTRATE_INSTANCE_URL  service instance URL (Orchestrate Settings > API details)
    ORCHESTRATE_API_KEY       API key generated there
    ORCHESTRATE_AGENT_ID      the agent's ID (`orchestrate agents list -k native`, ID column)
    ORCHESTRATE_AUTH_TYPE     optional: ibm_iam, mcsp, mcsp_v1 or mcsp_v2 (same names as
                              `orchestrate env add --type`); inferred when empty
    ORCHESTRATE_IAM_URL       optional: base URL of the token service, as `--iam-url` in the ADK

How the token is obtained mirrors the ADK (ibm_watsonx_orchestrate_clients/common/
service_instance/service_instance.py, ADK 2.19.1):
  - host contains ".cloud.ibm.com"  -> IBM Cloud IAM, form POST to iam.cloud.ibm.com/identity/token
  - otherwise (AWS-hosted SaaS such as api.<region>.dl.watson-orchestrate.ibm.com) -> MCSP:
      key decodes to "k1:" -> MCSP v1: JSON POST {base}/siusermgr/api/1.0/apikeys/token,
                              base https://iam.platform.saas.ibm.com
      key decodes to "k2:" -> MCSP v2: JSON POST {base}/api/2.0/apikeys/token with X-API-Key,
                              base https://account-iam.platform.saas.ibm.com
      neither               -> try v1, then v2 (as the ADK's "mcsp" type does)

Nothing here logs or returns the API key or the access token.
"""
from __future__ import annotations

import base64
import binascii
import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional
from urllib.parse import urlparse

import httpx

IBM_IAM = "ibm_iam"
MCSP = "mcsp"
MCSP_V1 = "mcsp_v1"
MCSP_V2 = "mcsp_v2"
AUTH_TYPES = (IBM_IAM, MCSP, MCSP_V1, MCSP_V2)

DEFAULT_IAM_URL = "https://iam.cloud.ibm.com/identity/token"
DEFAULT_MCSP_V1_BASE = "https://iam.platform.saas.ibm.com"
DEFAULT_MCSP_V2_BASE = "https://account-iam.platform.saas.ibm.com"
MCSP_V2_BASE_BY_REGION = {"germanywestcentral": "https://account-iam.azure.westus3.platform.saas.ibm.com"}
MCSP_V1_PATH = "/siusermgr/api/1.0/apikeys/token"
MCSP_V2_PATH = "/api/2.0/apikeys/token"
MCSP_V2_QUERY = {"includeBuiltinActions": "false", "includeCustomActions": "false",
                 "includeRoles": "true", "prefixRolesWithDefinitionScope": "false"}

DEFAULT_TIMEOUT_S = 20.0
TOKEN_REFRESH_MARGIN_S = 300
DETAIL_CHARS = 300

# Tests replace this with an httpx.MockTransport; None means real network.
_TRANSPORT: Optional[httpx.BaseTransport] = None


class AgentUnavailable(Exception):
    """The agent could not answer. `reason` is a short code that is safe to log and return."""

    def __init__(self, reason: str, status: Optional[int] = None, detail: str = ""):
        super().__init__(reason)
        self.reason = reason
        self.status = status
        self.detail = detail


@dataclass(frozen=True)
class AgentSettings:
    instance_url: str
    api_key: str
    agent_id: str
    auth_type: str = ""      # "" means infer from the host and key, like the ADK
    iam_url: str = ""        # "" means the default for the auth type

    def __repr__(self) -> str:  # never show the key
        return (f"AgentSettings(instance_url={self.instance_url!r}, agent_id={self.agent_id!r}, "
                f"auth_type={self.auth_type!r}, iam_url={self.iam_url!r}, api_key=***)")


@dataclass
class AgentReply:
    reply: str
    thread_id: Optional[str]
    status: int
    response_keys: list[str]


def load_settings() -> Optional[AgentSettings]:
    """Settings from the environment, or None when any required value is missing."""
    url = os.getenv("ORCHESTRATE_INSTANCE_URL", "").strip().rstrip("/")
    key = os.getenv("ORCHESTRATE_API_KEY", "").strip()
    agent = os.getenv("ORCHESTRATE_AGENT_ID", "").strip()
    if not (url and key and agent):
        return None
    auth = os.getenv("ORCHESTRATE_AUTH_TYPE", "").strip().lower()
    iam = os.getenv("ORCHESTRATE_IAM_URL", "").strip().rstrip("/")
    return AgentSettings(instance_url=url, api_key=key, agent_id=agent,
                         auth_type=auth if auth in AUTH_TYPES else "", iam_url=iam)


def mcsp_key_version(api_key: str) -> Optional[str]:
    """'k1' or 'k2' if the key is an MCSP key (base64 of 'k1:...' / 'k2:...'), else None."""
    try:
        stripped = api_key.rstrip("=")
        decoded = base64.b64decode(stripped + "=" * ((4 - len(stripped) % 4) % 4), validate=True)
    except (binascii.Error, ValueError):
        return None
    prefix = decoded[:3]
    return {b"k1:": "k1", b"k2:": "k2"}.get(prefix)


def auth_plan(settings: AgentSettings) -> list[str]:
    """The token methods to try, in order, following the ADK's inference."""
    if settings.auth_type == MCSP:
        return [MCSP_V1, MCSP_V2]
    if settings.auth_type:
        return [settings.auth_type]
    host = urlparse(settings.instance_url).hostname or ""
    if ".cloud.ibm.com" in host:
        return [IBM_IAM]
    version = mcsp_key_version(settings.api_key)
    if version == "k1":
        return [MCSP_V1]
    if version == "k2":
        return [MCSP_V2]
    return [MCSP_V1, MCSP_V2]


def token_url(settings: AgentSettings, method: str) -> str:
    if method == IBM_IAM:
        return settings.iam_url or DEFAULT_IAM_URL
    if method == MCSP_V1:
        return (settings.iam_url or DEFAULT_MCSP_V1_BASE) + MCSP_V1_PATH
    host = urlparse(settings.instance_url).hostname or ""
    base = settings.iam_url or next((url for region, url in MCSP_V2_BASE_BY_REGION.items() if region in host),
                                    DEFAULT_MCSP_V2_BASE)
    return base + MCSP_V2_PATH


def _safe_detail(text: str, *secrets: str) -> str:
    """First DETAIL_CHARS characters of a response body with any secret blanked out."""
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return text[:DETAIL_CHARS]


def _jwt_lifetime(token: str) -> Optional[float]:
    """Seconds until expiry from an unverified JWT's exp claim, or None if unreadable."""
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return float(claims["exp"]) - time.time()
    except (IndexError, ValueError, KeyError, TypeError, binascii.Error):
        return None


def agent_message(text: str, ui_language: str) -> str:
    """The two-line message format the agent's instructions expect."""
    return f"ui_language: {ui_language}\nworker_text: {text.strip()}"


def _reply_text(data: Any) -> str:
    """Pull the assistant text out of a chat completion. Shapes seen in the API schema vary."""
    try:
        choice = data["choices"][0]
    except (KeyError, IndexError, TypeError) as exc:
        raise AgentUnavailable("unexpected_response") from exc
    message = choice.get("message", choice) if isinstance(choice, dict) else {}
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text = "\n".join(
            item.get("text", "") for item in content
            if isinstance(item, dict) and item.get("response_type", "text") == "text"
        )
    else:
        text = ""
    if not text.strip():
        raise AgentUnavailable("empty_reply")
    return text.strip()


class OrchestrateClient:
    def __init__(self, settings: AgentSettings, clock: Callable[[], float] = time.monotonic):
        self.settings = settings
        self._clock = clock
        self._token: Optional[str] = None
        self._token_expires_at = 0.0
        self._lock = threading.Lock()

    def _http(self, timeout: float) -> httpx.Client:
        return httpx.Client(timeout=timeout, transport=_TRANSPORT)

    def _remaining(self, deadline: float) -> float:
        left = deadline - self._clock()
        if left <= 0.5:
            raise AgentUnavailable("timeout")
        return left

    def _request_token(self, method: str, deadline: float) -> tuple[str, float]:
        """One token request. Returns (token, lifetime in seconds) or raises AgentUnavailable."""
        key = self.settings.api_key
        url = token_url(self.settings, method)
        try:
            with self._http(self._remaining(deadline)) as http:
                if method == IBM_IAM:
                    response = http.post(url, data={"grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                                                    "apikey": key},
                                         headers={"Accept": "application/json"})
                elif method == MCSP_V1:
                    response = http.post(url, json={"apikey": key},
                                         headers={"Accept": "application/json"})
                else:
                    response = http.post(url, json={"apikey": key}, params=MCSP_V2_QUERY,
                                         headers={"Accept": "application/json", "X-API-Key": key})
        except httpx.TimeoutException as exc:
            raise AgentUnavailable("timeout") from exc
        except httpx.HTTPError as exc:
            raise AgentUnavailable("token_network_error", detail=f"{method} {type(exc).__name__}") from exc

        if response.status_code != 200:
            raise AgentUnavailable("token_rejected", status=response.status_code,
                                   detail=f"{method}: " + _safe_detail(response.text, key))
        try:
            body = response.json()
        except ValueError as exc:
            raise AgentUnavailable("token_missing", status=200, detail=f"{method}: response is not JSON") from exc
        token = body.get("access_token") or body.get("token") if isinstance(body, dict) else None
        if not token:
            keys = ", ".join(sorted(body)) if isinstance(body, dict) else type(body).__name__
            raise AgentUnavailable("token_missing", status=200, detail=f"{method}: response keys: {keys}")
        lifetime = body.get("expires_in") or body.get("expiresIn") or _jwt_lifetime(token) or 3600
        return token, float(lifetime)

    def _get_token(self, deadline: float) -> str:
        with self._lock:
            if self._token and self._clock() < self._token_expires_at:
                return self._token
            failures: list[AgentUnavailable] = []
            for method in auth_plan(self.settings):
                try:
                    token, lifetime = self._request_token(method, deadline)
                except AgentUnavailable as exc:
                    if exc.reason == "timeout":
                        raise
                    failures.append(exc)
                    continue
                self._token = token
                self._token_expires_at = self._clock() + max(60.0, lifetime - TOKEN_REFRESH_MARGIN_S)
                return token
            last = failures[-1]
            raise AgentUnavailable(last.reason, status=last.status,
                                   detail=" | ".join(f.detail for f in failures if f.detail))

    def _forget_token(self) -> None:
        with self._lock:
            self._token = None
            self._token_expires_at = 0.0

    def chat(self, text: str, ui_language: str, timeout: float = DEFAULT_TIMEOUT_S) -> AgentReply:
        """One stateless turn: the frontend always sends everything the worker has said."""
        deadline = self._clock() + timeout
        token = self._get_token(deadline)
        url = f"{self.settings.instance_url}/v1/orchestrate/{self.settings.agent_id}/chat/completions"
        payload = {"messages": [{"role": "user", "content": agent_message(text, ui_language)}],
                   "stream": False}
        try:
            with self._http(self._remaining(deadline)) as http:
                response = http.post(url, json=payload, headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                })
        except httpx.TimeoutException as exc:
            raise AgentUnavailable("timeout") from exc
        except httpx.HTTPError as exc:
            raise AgentUnavailable("network_error") from exc

        if response.status_code == 401:
            self._forget_token()
        if response.status_code != 200:
            raise AgentUnavailable("agent_http_error", status=response.status_code,
                                   detail=_safe_detail(response.text, self.settings.api_key, token))
        try:
            data = response.json()
        except ValueError as exc:
            raise AgentUnavailable("unexpected_response", status=200) from exc
        return AgentReply(
            reply=_reply_text(data),
            thread_id=data.get("thread_id") if isinstance(data, dict) else None,
            status=response.status_code,
            response_keys=sorted(data) if isinstance(data, dict) else [],
        )


_CLIENT: Optional[OrchestrateClient] = None
_CLIENT_LOCK = threading.Lock()


def get_client() -> Optional[OrchestrateClient]:
    """A shared client so the token cache survives between requests; None if not configured."""
    global _CLIENT
    settings = load_settings()
    if settings is None:
        return None
    with _CLIENT_LOCK:
        if _CLIENT is None or _CLIENT.settings != settings:
            _CLIENT = OrchestrateClient(settings)
        return _CLIENT
