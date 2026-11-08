"""POST /api/matches"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from db.database import get_all_jobs
from models.worker import WorkerProfile
from models.job import MatchResponse
from tools.follow_up import follow_up as _follow_up, follow_up_for
from tools.job_ranker import rank_jobs

router = APIRouter(prefix="/api", tags=["matches"])

__all__ = ["router", "_follow_up"]


class MatchRequest(BaseModel):
    profile: WorkerProfile


@router.post("/matches", response_model=MatchResponse)
def get_matches(req: MatchRequest) -> MatchResponse:
    """
    Return top-10 ranked job matches for a worker profile.

    If the profile has no area or no skills, returns a follow_up_question
    in the worker's language instead of results.
    """
    question = follow_up_for(req.profile)
    if question:
        return MatchResponse(matches=[], follow_up_question=question)

    all_jobs = get_all_jobs()
    matches = rank_jobs(req.profile, all_jobs)
    return MatchResponse(matches=matches)
