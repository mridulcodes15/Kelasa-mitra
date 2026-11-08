from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field


class AreaLocation(BaseModel):
    id: str
    name: str
    lat: float
    lon: float


class WorkerProfile(BaseModel):
    skills: List[str] = Field(default_factory=list, description="Normalised skill IDs from taxonomy")
    experience_years: Optional[float] = Field(None, description="Total years of relevant experience")
    area: Optional[AreaLocation] = Field(None, description="Resolved Bengaluru area with coordinates")
    languages: List[str] = Field(default_factory=list, description="Languages spoken by worker")
    detected_language: str = Field("en", description="Language detected in input text (en/kn/hi)")
    raw_input: str = Field("", description="Original text submitted by worker")
