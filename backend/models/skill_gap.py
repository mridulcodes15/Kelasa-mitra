from __future__ import annotations
from typing import List
from pydantic import BaseModel


class LearningStep(BaseModel):
    step: int
    action: str
    weeks: int
    approx_cost_inr: int


class SkillGapItem(BaseModel):
    skill_id: str
    label_en: str
    jobs_unlocked: int          # extra jobs that become a strong match (score ≥ 60)
    avg_pay_uplift_inr: int     # average pay of unlocked jobs minus worker's current avg pay
    explanation: str            # template-built, in worker's language
    learning_path: List[LearningStep]


class SkillGapResponse(BaseModel):
    gaps: List[SkillGapItem]    # top 3, sorted by jobs_unlocked desc, then pay_uplift desc
    is_synthetic: bool = True   # always true — all numbers come from seed data
