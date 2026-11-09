"""
POST /api/agent/chat - asks the Kelasa Mitra agent in IBM watsonx Orchestrate.

The browser never sees the Orchestrate key. If the agent is not configured, slow or
failing, the response says source="rules" and carries the rule-based follow-up question
(if any); the frontend shows an "agent offline" banner and keeps using the deterministic
endpoints, which run the same rules the agent's tools run.

Job and skill-gap cards never come from the agent's text.
"""
from __future__ import annotations

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from tools.follow_up import follow_up_for
from tools.orchestrate_client import AgentUnavailable, get_client
from tools.profile_extractor import extract_profile
from tools.rate_limit import AGENT_LIMITER, rate_limited

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = logging.getLogger(__name__)

SUPPORTED = ("en", "kn", "hi")


class AgentChatRequest(BaseModel):
    text: str = Field(..., max_length=2000)
    ui_language: str = "en"


class AgentChatResponse(BaseModel):
    source: Literal["agent", "rules"]
    reply: Optional[str] = None
    reason: Optional[str] = None  # why the rules were used: not_configured, timeout, ...
    thread_id: Optional[str] = None


@router.post("/chat", response_model=AgentChatResponse,
             dependencies=[Depends(rate_limited(AGENT_LIMITER))])
def agent_chat(req: AgentChatRequest) -> AgentChatResponse:
    language = req.ui_language if req.ui_language in SUPPORTED else "en"
    client = get_client()
    if client is not None and req.text.strip():
        try:
            answer = client.chat(req.text, language)
            return AgentChatResponse(source="agent", reply=answer.reply, thread_id=answer.thread_id)
        except AgentUnavailable as exc:
            logger.warning("Orchestrate agent unavailable (%s, status=%s); using rules.", exc.reason, exc.status)
            reason = exc.reason
    else:
        reason = "not_configured" if client is None else "empty_text"

    question = follow_up_for(extract_profile(req.text, ui_language=language)) if req.text.strip() else None
    return AgentChatResponse(source="rules", reply=question, reason=reason)
