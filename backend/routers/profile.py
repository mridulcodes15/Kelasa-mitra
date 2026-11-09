"""POST /api/profile/extract-profile"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from tools.profile_extractor import extract_profile
from tools.rate_limit import EXTRACT_LIMITER, rate_limited
from models.worker import WorkerProfile

router = APIRouter(prefix="/api/profile", tags=["profile"])

# Same limit as /api/agent/chat: bounds the work done on untrusted input.
MAX_TEXT_CHARS = 2000


class ExtractRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_CHARS)
    ui_language: Optional[str] = None  # "en" | "kn" | "hi" — set by frontend language picker


@router.post("/extract-profile", response_model=WorkerProfile,
             dependencies=[Depends(rate_limited(EXTRACT_LIMITER))])
def extract_profile_endpoint(req: ExtractRequest) -> WorkerProfile:
    """
    Extract a structured worker profile from free-form text.

    Input  : { "text": "...", "ui_language": "kn" }   (ui_language is optional)
    Output : WorkerProfile JSON
    """
    return extract_profile(req.text, ui_language=req.ui_language)
