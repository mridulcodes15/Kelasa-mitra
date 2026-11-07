from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


class Job(BaseModel):
    id: str
    title: str
    employer: str
    area: str
    lat: float
    lon: float
    pay_min: int
    pay_max: int
    skills_required: List[str]
    languages: List[str]
    type: str          # "job" | "apprenticeship"
    posted_at: str     # ISO8601
    is_synthetic: bool


class JobMatch(BaseModel):
    job: Job
    score: int                    # 0-100 integer
    distance_km: float
    matched_skills: List[str]
    missing_skills: List[str]
    reason: str                   # plain-language explanation in worker's language


class MatchResponse(BaseModel):
    matches: List[JobMatch]
    follow_up_question: Optional[str] = None  # set when profile is incomplete
