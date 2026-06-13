from __future__ import annotations

import asyncio

import structlog

from app.config import get_settings
from app.graph.state import PipelineState
from app.llm import chat_json
from app.models import Restaurant
from app.providers.base import get_provider

log = structlog.get_logger()

_SUMMARY_SYSTEM = """\
You are a restaurant review summarizer. Summarize the provided reviews into 1-2 sentences
highlighting recurring themes (food quality, service, atmosphere, value).
Always mention at least one reviewer by name for attribution.
Do NOT invent any content — only use text from the provided reviews.
Return JSON: {"summary": "<1-2 sentence summary>"}
"""


async def _summarize_reviews(restaurant: Restaurant) -> str | None:
    """Use LLM to summarize real reviews. Returns summary string or None."""
    if not restaurant.reviews:
        return None

    settings = get_settings()
    review_text = "\n".join(
        f"- {r.author_name} ({r.rating}/5): {r.text}" for r in restaurant.reviews
    )

    messages = [
        {"role": "system", "content": _SUMMARY_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Restaurant: {restaurant.name}\n\nReviews:\n{review_text}\n\n"
                "Summarize these reviews in 1-2 sentences with reviewer attribution."
            ),
        },
    ]

    try:
        raw = await chat_json(messages, model=settings.llm_model)
        summary = raw.get("summary", "")
        return str(summary) if summary else None
    except Exception as exc:
        log.warning("enrich_summary_error", place_id=restaurant.place_id, error=str(exc))
        return None


async def _enrich_one(restaurant: Restaurant) -> Restaurant:
    """Fetch details for a single restaurant and add review summary."""
    provider = get_provider()

    try:
        detailed = await provider.details(restaurant.place_id)
        if detailed is not None:
            # Merge: keep existing fields where provider returns None
            restaurant = Restaurant(
                place_id=restaurant.place_id,
                name=detailed.name or restaurant.name,
                address=detailed.address or restaurant.address,
                rating=detailed.rating if detailed.rating is not None else restaurant.rating,
                rating_count=(
                    detailed.rating_count
                    if detailed.rating_count is not None
                    else restaurant.rating_count
                ),
                price_level=(
                    detailed.price_level
                    if detailed.price_level is not None
                    else restaurant.price_level
                ),
                cuisine_types=detailed.cuisine_types or restaurant.cuisine_types,
                hours=detailed.hours or restaurant.hours,
                website=detailed.website or restaurant.website,
                phone=detailed.phone or restaurant.phone,
                photo_url=detailed.photo_url or restaurant.photo_url,
                reviews=detailed.reviews if detailed.reviews else restaurant.reviews,
                lat=detailed.lat if detailed.lat is not None else restaurant.lat,
                lng=detailed.lng if detailed.lng is not None else restaurant.lng,
                menu_summary=restaurant.menu_summary,
            )
    except Exception as exc:
        log.warning("enrich_details_error", place_id=restaurant.place_id, error=str(exc))

    # LLM review summary
    summary = await _summarize_reviews(restaurant)
    if summary:
        restaurant = restaurant.model_copy(update={"menu_summary": summary})

    return restaurant


async def run(state: PipelineState) -> PipelineState:
    """Enrich node: fetch details + real reviews for each restaurant, add LLM summary."""
    errors: list[str] = list(state.get("errors", []))
    restaurants: list[Restaurant] = state.get("restaurants", [])

    if not restaurants:
        log.warning("enrich_skipped", reason="no restaurants from discovery")
        return {
            **state,
            "enriched_restaurants": [],
            "errors": errors,
            "current_step": "enrich",
        }

    # Enrich concurrently but respect semaphore inside each call
    tasks = [_enrich_one(r) for r in restaurants]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    enriched: list[Restaurant] = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            log.error(
                "enrich_one_failed",
                place_id=restaurants[i].place_id,
                error=str(result),
            )
            errors.append(f"Failed to enrich '{restaurants[i].name}': {result}")
            enriched.append(restaurants[i])  # keep the unenriched version
        else:
            enriched.append(result)

    log.info("enrich_done", count=len(enriched))

    return {
        **state,
        "enriched_restaurants": enriched,
        "errors": errors,
        "current_step": "enrich",
    }
