"""POST /api/profile/extract-profile"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from tools.profile_extractor import extract_profile
from models.worker import WorkerProfile

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ExtractRequest(BaseModel):
    text: str
    ui_language: Optional[str] = None  # "en" | "kn" | "hi" — set by frontend language picker


@router.post("/extract-profile", response_model=WorkerProfile)
def extract_profile_endpoint(req: ExtractRequest) -> WorkerProfile:
    """
    Extract a structured worker profile from free-form text.

    Input  : { "text": "...", "ui_language": "kn" }   (ui_language is optional)
    Output : WorkerProfile JSON
    """
    return extract_profile(req.text, ui_language=req.ui_language)
