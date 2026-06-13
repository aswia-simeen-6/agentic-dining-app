from __future__ import annotations

import structlog

from app.graph.state import PipelineState
from app.models import Restaurant
from app.providers.base import get_provider

log = structlog.get_logger()


async def run(state: PipelineState) -> PipelineState:
    """Discovery node: fetch real restaurants from the configured provider."""
    errors: list[str] = list(state.get("errors", []))
    supervisor = state.get("supervisor_output")

    if supervisor is None:
        errors.append("Discovery skipped: supervisor_output is missing.")
        return {
            **state,
            "restaurants": [],
            "errors": errors,
            "current_step": "discovery",
        }

    provider = get_provider()

    try:
        restaurants: list[Restaurant] = await provider.search(
            query=supervisor.query_clean,
            location=supervisor.location,
            cuisines=supervisor.cuisine_preferences,
            price_tier=supervisor.price_tier,
        )
    except Exception as exc:
        log.error("discovery_error", error=str(exc))
        errors.append(f"Discovery error: {exc}")
        restaurants = []

    if not restaurants:
        errors.append(
            f"No restaurants found for '{supervisor.query_clean}' in '{supervisor.location}'."
        )
        log.warning(
            "discovery_empty",
            query=supervisor.query_clean,
            location=supervisor.location,
        )
    else:
        log.info(
            "discovery_done",
            count=len(restaurants),
            location=supervisor.location,
        )

    return {
        **state,
        "restaurants": restaurants,
        "errors": errors,
        "current_step": "discovery",
    }
