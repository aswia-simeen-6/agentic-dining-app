from __future__ import annotations

import structlog

from app.config import get_settings
from app.graph.state import PipelineState
from app.llm import chat_json
from app.models import RankedRestaurant, RecommendationResult

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a dining recommendation expert. You will be given a list of real restaurants with
real ratings and real reviews, and a user's preferences.

Your job is to rank the top 1-3 restaurants (fewer if less are available) that best match
the user's preferences. You MUST only reference restaurants from the provided list — do NOT
invent any restaurant names or place IDs.

Return ONLY a valid JSON object:
{
  "ranked": [
    {"place_id": "<exact place_id from the list>", "rank": 1, "reason": "<why this is the top pick>"},
    {"place_id": "<exact place_id>", "rank": 2, "reason": "<reason>"},
    {"place_id": "<exact place_id>", "rank": 3, "reason": "<reason>"}
  ],
  "explanation": "<1-2 sentence overall recommendation summary>"
}

Rank fewer than 3 only if fewer restaurants were provided.
Base your reasoning on the real data provided (ratings, reviews, cuisine, price).
"""


def _format_restaurants(restaurants: list) -> str:
    lines: list[str] = []
    for r in restaurants:
        review_excerpts = ""
        if r.reviews:
            excerpts = [f"  * {rv.author_name}: \"{rv.text[:150]}\"" for rv in r.reviews[:3]]
            review_excerpts = "\n" + "\n".join(excerpts)

        lines.append(
            f"place_id: {r.place_id}\n"
            f"name: {r.name}\n"
            f"cuisine: {', '.join(r.cuisine_types) or 'unknown'}\n"
            f"rating: {r.rating or 'N/A'} ({r.rating_count or 0} reviews)\n"
            f"price_level: {r.price_level or 'N/A'}\n"
            f"address: {r.address}\n"
            f"hours: {r.hours or 'N/A'}\n"
            f"review_summary: {r.menu_summary or 'N/A'}"
            + review_excerpts
        )
    return "\n\n---\n\n".join(lines)


async def run(state: PipelineState) -> PipelineState:
    """Recommendation node: rank real enriched restaurants using LLM + user preferences."""
    errors: list[str] = list(state.get("errors", []))
    enriched = state.get("enriched_restaurants", [])

    if not enriched:
        errors.append("Recommendation skipped: no enriched restaurants available.")
        return {
            **state,
            "recommendation": None,
            "errors": errors,
            "current_step": "recommendation",
        }

    supervisor = state.get("supervisor_output")
    settings = get_settings()

    # Build preference context
    prefs_parts: list[str] = []
    if supervisor:
        if supervisor.cuisine_preferences:
            prefs_parts.append(f"Cuisine preferences: {', '.join(supervisor.cuisine_preferences)}")
        if supervisor.price_tier:
            tier_labels = {1: "budget", 2: "moderate", 3: "upscale", 4: "fine dining"}
            prefs_parts.append(f"Price tier: {tier_labels.get(supervisor.price_tier, str(supervisor.price_tier))}")
        if supervisor.party_size:
            prefs_parts.append(f"Party size: {supervisor.party_size}")
        if supervisor.special_requests:
            prefs_parts.append(f"Special requests: {supervisor.special_requests}")
        prefs_parts.append(f"Location: {supervisor.location}")

    user_prefs = "\n".join(prefs_parts) if prefs_parts else "No specific preferences."
    restaurant_data = _format_restaurants(enriched)

    # Valid place_ids for validation
    valid_ids: set[str] = {r.place_id for r in enriched}

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"User preferences:\n{user_prefs}\n\n"
                f"Available restaurants:\n{restaurant_data}\n\n"
                f"Rank the best {min(3, len(enriched))} restaurant(s) for this user."
            ),
        },
    ]

    try:
        raw = await chat_json(messages, model=settings.llm_model_strong)

        ranked_raw = raw.get("ranked", [])
        explanation = str(raw.get("explanation", ""))

        # Validate: only keep place_ids that exist in our enriched list
        ranked: list[RankedRestaurant] = []
        seen_ranks: set[int] = set()
        for item in ranked_raw:
            pid = str(item.get("place_id", ""))
            rank = int(item.get("rank", 0))
            reason = str(item.get("reason", ""))

            if pid not in valid_ids:
                log.warning(
                    "recommendation_invalid_place_id",
                    place_id=pid,
                    valid_ids=list(valid_ids),
                )
                errors.append(f"LLM returned unknown place_id '{pid}' — ignored.")
                continue

            if rank in seen_ranks:
                continue
            seen_ranks.add(rank)

            ranked.append(RankedRestaurant(place_id=pid, rank=rank, reason=reason))

        # Sort by rank
        ranked.sort(key=lambda x: x.rank)

        if not ranked:
            errors.append("Recommendation failed: no valid restaurants could be ranked.")
            return {
                **state,
                "recommendation": None,
                "errors": errors,
                "current_step": "recommendation",
            }

        recommendation = RecommendationResult(ranked=ranked, explanation=explanation)
        log.info(
            "recommendation_done",
            top_pick=ranked[0].place_id,
            total_ranked=len(ranked),
        )

    except Exception as exc:
        log.error("recommendation_error", error=str(exc))
        errors.append(f"Recommendation error: {exc}")
        return {
            **state,
            "recommendation": None,
            "errors": errors,
            "current_step": "recommendation",
        }

    return {
        **state,
        "recommendation": recommendation,
        "errors": errors,
        "current_step": "recommendation",
    }
