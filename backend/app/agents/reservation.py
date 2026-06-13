from __future__ import annotations

import urllib.parse

import structlog

from app.config import get_settings
from app.graph.state import PipelineState
from app.llm import chat_json
from app.models import ReservationResult

log = structlog.get_logger()

_DRAFT_SYSTEM = """\
You are a polite dining assistant helping a customer inquire about a table reservation.
Write a concise, friendly message that the customer can send to the restaurant.

Rules:
- Use the real restaurant name provided.
- Reference the real opening hours if provided (do NOT invent slots or times).
- Ask about availability for the given party size and any special requests.
- Do NOT promise or invent confirmed reservation slots.
- Keep it under 80 words.

Return ONLY a valid JSON object:
{"draft_message": "<message text>"}
"""


async def run(state: PipelineState) -> PipelineState:
    """Reservation node: build deep-link + draft inquiry message for top restaurant."""
    errors: list[str] = list(state.get("errors", []))
    recommendation = state.get("recommendation")

    if recommendation is None or not recommendation.ranked:
        errors.append("Reservation skipped: no recommendation available.")
        return {
            **state,
            "reservation": None,
            "errors": errors,
            "current_step": "reservation",
        }

    top = recommendation.ranked[0]

    # Find the restaurant object for the top pick
    enriched = state.get("enriched_restaurants", [])
    restaurant = next((r for r in enriched if r.place_id == top.place_id), None)

    if restaurant is None:
        errors.append(f"Reservation error: restaurant '{top.place_id}' not found in enriched list.")
        return {
            **state,
            "reservation": None,
            "errors": errors,
            "current_step": "reservation",
        }

    # Build Google Maps deep-link (real, publicly documented format)
    encoded_name = urllib.parse.quote(restaurant.name)
    deep_link = (
        f"https://www.google.com/maps/search/?api=1"
        f"&query={encoded_name}"
        f"&query_place_id={restaurant.place_id}"
    )

    # Gather context for draft message
    supervisor = state.get("supervisor_output")
    party_size = supervisor.party_size if supervisor else 2
    special_requests = supervisor.special_requests if supervisor else ""
    hours_info = f" Their hours are: {restaurant.hours}." if restaurant.hours else ""

    settings = get_settings()

    messages = [
        {"role": "system", "content": _DRAFT_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Restaurant name: {restaurant.name}\n"
                f"Opening hours: {restaurant.hours or 'not available'}\n"
                f"Party size: {party_size}\n"
                f"Special requests: {special_requests or 'none'}\n\n"
                "Write a polite reservation inquiry message."
            ),
        },
    ]

    draft_message = (
        f"Hello, I'd like to inquire about table availability at {restaurant.name} "
        f"for a party of {party_size}."
        + (f" {special_requests}." if special_requests else "")
        + hours_info
        + " Please let me know your availability. Thank you!"
    )

    try:
        raw = await chat_json(messages, model=settings.llm_model)
        llm_draft = raw.get("draft_message", "")
        if llm_draft and isinstance(llm_draft, str) and len(llm_draft.strip()) > 10:
            draft_message = llm_draft.strip()
    except Exception as exc:
        log.warning(
            "reservation_draft_error",
            error=str(exc),
            fallback="using default draft",
        )
        errors.append(f"Draft message used fallback due to LLM error: {exc}")

    reservation = ReservationResult(
        place_id=restaurant.place_id,
        name=restaurant.name,
        deep_link=deep_link,
        draft_message=draft_message,
    )

    log.info(
        "reservation_done",
        place_id=restaurant.place_id,
        name=restaurant.name,
    )

    return {
        **state,
        "reservation": reservation,
        "errors": errors,
        "current_step": "reservation",
    }
