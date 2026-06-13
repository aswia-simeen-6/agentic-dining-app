import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from app.providers.google_places import GooglePlacesProvider


FIXTURE_SEARCH = {
    "places": [
        {
            "id": "ChIJtest001",
            "displayName": {"text": "Bella Italia"},
            "formattedAddress": "123 Main St, New York, NY 10001",
            "rating": 4.5,
            "userRatingCount": 320,
            "priceLevel": "PRICE_LEVEL_MODERATE",
            "types": ["restaurant", "italian_restaurant"],
            "websiteUri": "https://bellaitalia.example.com",
            "nationalPhoneNumber": "+1 555-0100",
            "location": {"latitude": 40.7128, "longitude": -74.0060},
            "currentOpeningHours": {"weekdayDescriptions": ["Monday: 11:00 AM – 10:00 PM"]},
        }
    ]
}


@pytest.mark.asyncio
async def test_search_returns_restaurants():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = FIXTURE_SEARCH
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        provider = GooglePlacesProvider()
        results = await provider.search("Italian", "New York, NY", ["italian"], 2)

    assert len(results) == 1
    assert results[0].place_id == "ChIJtest001"
    assert results[0].name == "Bella Italia"
    assert results[0].rating == 4.5


@pytest.mark.asyncio
async def test_search_handles_api_error():
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.raise_for_status.side_effect = Exception("Forbidden")

    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        provider = GooglePlacesProvider()
        results = await provider.search("Italian", "NYC", [], None)

    assert results == []
