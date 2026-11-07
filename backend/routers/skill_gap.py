"""POST /api/skill-gap"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from db.database import get_all_jobs
from models.worker import WorkerProfile
from models.skill_gap import SkillGapResponse
from tools.skill_gap import compute_skill_gap

router = APIRouter(prefix="/api", tags=["skill-gap"])


class SkillGapRequest(BaseModel):
    profile: WorkerProfile


@router.post("/skill-gap", response_model=SkillGapResponse)
def get_skill_gap(req: SkillGapRequest) -> SkillGapResponse:
    """
    Return top-3 skill gaps for a worker profile.

    All numbers (jobs_unlocked, avg_pay_uplift_inr) are derived purely from
    the seed jobs database — no LLM is involved in generating numbers.
    """
    all_jobs = get_all_jobs()
    return compute_skill_gap(req.profile, all_jobs)
