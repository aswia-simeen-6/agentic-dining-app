import pytest
from unittest.mock import AsyncMock, patch
from app.agents.recommendation import run
from app.graph.state import PipelineState
from app.models import SupervisorOutput


def make_state(with_restaurants=True) -> PipelineState:
    restaurants = []
    if with_restaurants:
        from tests.conftest import *
        from app.models import Restaurant
        restaurants = [
            Restaurant(place_id="p1", name="Bella Italia", address="NYC", rating=4.5,
                       rating_count=100, price_level=2, cuisine_types=["italian"],
                       hours=None, website=None, phone=None, photo_url=None,
                       reviews=[], lat=None, lng=None, menu_summary=None),
            Restaurant(place_id="p2", name="La Piazza", address="NYC", rating=4.2,
                       rating_count=80, price_level=3, cuisine_types=["italian"],
                       hours=None, website=None, phone=None, photo_url=None,
                       reviews=[], lat=None, lng=None, menu_summary=None),
        ]

    return PipelineState(
        query="Italian in NYC",
        session_id="test",
        supervisor_output=SupervisorOutput(
            query_clean="Italian restaurant in NYC",
            location="New York, NY",
            cuisine_preferences=["italian"],
            price_tier=2,
            party_size=2,
            special_requests="",
            agents_activated=["discovery", "enrich", "recommendation", "reservation"],
        ),
        restaurants=restaurants,
        enriched_restaurants=restaurants,
        recommendation=None,
        reservation=None,
        errors=[],
        current_step="enrich",
    )


@pytest.mark.asyncio
async def test_recommendation_ranks_restaurants():
    mock_output = {
        "ranked": [
            {"place_id": "p1", "rank": 1, "reason": "Best rating and value"},
            {"place_id": "p2", "rank": 2, "reason": "Great ambiance"},
        ],
        "explanation": "Bella Italia tops for its consistency.",
    }
    with patch("app.agents.recommendation.chat_json", AsyncMock(return_value=mock_output)):
        state = await run(make_state())

    assert state["recommendation"] is not None
    assert state["recommendation"].ranked[0].place_id == "p1"
    assert state["recommendation"].ranked[0].rank == 1


@pytest.mark.asyncio
async def test_recommendation_skips_on_empty_restaurants():
    state = await run(make_state(with_restaurants=False))
    assert state["recommendation"] is None
    assert any("no restaurant" in e.lower() for e in state["errors"])
