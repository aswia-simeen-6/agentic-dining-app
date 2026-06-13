import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.models import Restaurant, ReviewSnippet


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_restaurant():
    return Restaurant(
        place_id="ChIJtest123",
        name="Bella Italia",
        address="123 Main St, New York, NY",
        rating=4.5,
        rating_count=320,
        price_level=2,
        cuisine_types=["italian", "pasta"],
        hours="Mon-Sun 11am-10pm",
        website="https://bellaitalia.example.com",
        phone="+1-555-0100",
        photo_url=None,
        reviews=[
            ReviewSnippet(
                author_name="Alice",
                author_url="https://google.com/maps/contrib/alice",
                text="Amazing pasta, great ambiance!",
                rating=5,
                relative_time="2 weeks ago",
            )
        ],
        lat=40.7128,
        lng=-74.0060,
        menu_summary=None,
    )


@pytest.fixture
def mock_llm_response():
    async def _mock(*args, **kwargs):
        return {"result": "mocked"}
    return _mock
