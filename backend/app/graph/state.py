from __future__ import annotations

from typing import TypedDict

from app.models import (
    RecommendationResult,
    ReservationResult,
    Restaurant,
    SupervisorOutput,
)


class PipelineState(TypedDict):
    query: str
    session_id: str
    supervisor_output: SupervisorOutput | None
    restaurants: list[Restaurant]           # filled by discovery
    enriched_restaurants: list[Restaurant]  # filled by enrich (adds reviews/details)
    recommendation: RecommendationResult | None
    reservation: ReservationResult | None
    errors: list[str]
    current_step: str
