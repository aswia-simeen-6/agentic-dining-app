from __future__ import annotations

from datetime import datetime

import structlog

from app.config import get_settings
from app.graph.state import PipelineState
from app.llm import chat_json
from app.models import SupervisorOutput

log = structlog.get_logger()

_SYSTEM_PROMPT = """\
You are a dining intent parser. Today is {today}.

Given a user query, extract the following fields and return ONLY a valid JSON object:

{{
  "query_clean": "<cleaned, concise version of the user query>",
  "location": "<city, neighbourhood, or address the user wants to dine in>",
  "cuisine_preferences": ["<cuisine type>", ...],
  "price_tier": <1|2|3|4|null>,
  "party_size": <integer, default 2>,
  "special_requests": "<dietary restrictions, accessibility, ambiance, etc.>",
  "agents_activated": ["discovery", "enrich", "recommendation", "reservation"]
}}

Price tiers: 1=budget, 2=moderate, 3=upscale, 4=fine dining.
If you cannot determine a field, use the default: location defaults to "nearby", price_tier to null, party_size to 2.
Do NOT invent restaurants or places. Only parse the user's intent.
"""


async def run(state: PipelineState) -> PipelineState:
    """Supervisor node: parse user query into structured SupervisorOutput."""
    settings = get_settings()
    today = datetime.now().strftime("%A, %B %d, %Y")

    messages = [
        {
            "role": "system",
            "content": _SYSTEM_PROMPT.format(today=today),
        },
        {
            "role": "user",
            "content": state["query"],
        },
    ]

    errors: list[str] = list(state.get("errors", []))

    try:
        raw = await chat_json(messages, model=settings.llm_model_strong)

        # Validate and coerce
        supervisor_output = SupervisorOutput(
            query_clean=str(raw.get("query_clean", state["query"])),
            location=str(raw.get("location", "nearby")),
            cuisine_preferences=[
                str(c) for c in raw.get("cuisine_preferences", [])
            ],
            price_tier=raw.get("price_tier"),
            party_size=int(raw.get("party_size", 2)),
            special_requests=str(raw.get("special_requests", "")),
            agents_activated=[
                str(a)
                for a in raw.get(
                    "agents_activated",
                    ["discovery", "enrich", "recommendation", "reservation"],
                )
            ],
        )

        log.info(
            "supervisor_done",
            location=supervisor_output.location,
            cuisines=supervisor_output.cuisine_preferences,
            party_size=supervisor_output.party_size,
        )

    except Exception as exc:
        log.error("supervisor_error", error=str(exc))
        errors.append(f"Supervisor parse error: {exc}")
        # Return safe defaults so pipeline can continue
        supervisor_output = SupervisorOutput(
            query_clean=state["query"],
            location="nearby",
            cuisine_preferences=[],
            price_tier=None,
            party_size=2,
            special_requests="",
            agents_activated=["discovery", "enrich", "recommendation", "reservation"],
        )

    return {
        **state,
        "supervisor_output": supervisor_output,
        "errors": errors,
        "current_step": "supervisor",
    }
