import pytest
from unittest.mock import AsyncMock, patch
from app.agents.supervisor import run
from app.graph.state import PipelineState


def make_state(query: str = "Italian restaurant in NYC") -> PipelineState:
    return PipelineState(
        query=query,
        session_id="test-session",
        supervisor_output=None,
        restaurants=[],
        enriched_restaurants=[],
        recommendation=None,
        reservation=None,
        errors=[],
        current_step="",
    )


@pytest.mark.asyncio
async def test_supervisor_parses_query():
    mock_output = {
        "query_clean": "Italian restaurant in NYC",
        "location": "New York, NY",
        "cuisine_preferences": ["italian"],
        "price_tier": 2,
        "party_size": 2,
        "special_requests": "",
        "agents_activated": ["discovery", "enrich", "recommendation", "reservation"],
    }
    with patch("app.agents.supervisor.chat_json", AsyncMock(return_value=mock_output)):
        state = await run(make_state())

    assert state["supervisor_output"] is not None
    assert state["supervisor_output"].location == "New York, NY"
    assert state["errors"] == []
    assert state["current_step"] == "supervisor"


@pytest.mark.asyncio
async def test_supervisor_handles_llm_failure():
    with patch("app.agents.supervisor.chat_json", AsyncMock(side_effect=Exception("LLM down"))):
        state = await run(make_state())

    assert len(state["errors"]) > 0
    assert "supervisor" in state["errors"][0].lower() or "llm" in state["errors"][0].lower()
