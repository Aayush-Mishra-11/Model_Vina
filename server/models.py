"""Pydantic schemas for legacy assistant / transcript routes.

These models are kept around for reference. The active code path uses the
per-feature routers (practice, partner, interview, challenge, etc.) and
their own request/response models.
"""

from pydantic import BaseModel
from typing import Optional


class SessionMetrics(BaseModel):
    fillerCount: int
    estimatedPace: str
    confidenceScore: int
    wordsSpoken: int


class TranscriptResponse(BaseModel):
    transcript: str
    languageAlert: Optional[str] = None
    metrics: SessionMetrics


class AssistantResponse(BaseModel):
    correctedText: str
    metrics: SessionMetrics
    languageAlert: Optional[str] = None
