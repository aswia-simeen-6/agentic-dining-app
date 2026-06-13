from __future__ import annotations

import hashlib
import time
from typing import Any

import httpx
import structlog

from app.config import get_settings
from app.models import Restaurant, ReviewSnippet

log = structlog.get_logger()

_PLACES_BASE = "https://places.googleapis.com/v1"
_MAX_RESULTS = 8
_CACHE_TTL = 300  # seconds

# In-memory short-TTL cache: {cache_key: (expiry_ts, data)}
_cache: dict[str, tuple[float, Any]] = {}

_SEARCH_FIELD_MASK = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.rating,"
    "places.userRatingCount,"
    "places.priceLevel,"
    "places.types,"
    "places.currentOpeningHours,"
    "places.websiteUri,"
    "places.nationalPhoneNumber,"
    "places.location,"
    "places.photos"
)

_DETAILS_FIELD_MASK = (
    "id,"
    "displayName,"
    "formattedAddress,"
    "rating,"
    "userRatingCount,"
    "priceLevel,"
    "types,"
    "currentOpeningHours,"
    "websiteUri,"
    "nationalPhoneNumber,"
    "location,"
    "photos,"
    "reviews"
)


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    expiry, data = entry
    if time.time() > expiry:
        del _cache[key]
        return None
    return data


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (time.time() + _CACHE_TTL, data)


def _price_level_map(raw: str | None) -> int | None:
    """Map Google price level string to integer 1-4."""
    mapping = {
        "PRICE_LEVEL_FREE": 1,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    if raw is None:
        return None
    return mapping.get(raw)


def _parse_opening_hours(raw: dict | None) -> str | None:
    if raw is None:
        return None
    weekday_text = raw.get("weekdayDescriptions") or raw.get("weekday_text", [])
    if weekday_text:
        return " | ".join(weekday_text[:3])  # first 3 days for brevity
    return None


def _parse_photo_url(photos: list | None, api_key: str) -> str | None:
    if not photos:
        return None
    ref = photos[0].get("name", "")
    if not ref:
        return None
    return f"https://places.googleapis.com/v1/{ref}/media?maxWidthPx=400&key={api_key}"


def _parse_reviews(raw_reviews: list | None) -> list[ReviewSnippet]:
    if not raw_reviews:
        return []
    snippets: list[ReviewSnippet] = []
    for rv in raw_reviews[:5]:
        author = rv.get("authorAttribution", {})
        text_obj = rv.get("text", {})
        text = text_obj.get("text", "") if isinstance(text_obj, dict) else str(text_obj)
        rating = rv.get("rating", 0)
        relative_time = rv.get("relativePublishTimeDescription", "")

        snippets.append(
            ReviewSnippet(
                author_name=author.get("displayName", "Anonymous"),
                author_url=author.get("uri", ""),
                text=text[:500],  # cap length
                rating=int(rating),
                relative_time=relative_time,
            )
        )
    return snippets


def _place_to_restaurant(place: dict, api_key: str) -> Restaurant:
    display_name = place.get("displayName", {})
    name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)

    location = place.get("location", {})
    lat = location.get("latitude") if location else None
    lng = location.get("longitude") if location else None

    cuisine_types: list[str] = []
    for t in place.get("types", []):
        if t not in ("restaurant", "food", "point_of_interest", "establishment"):
            cuisine_types.append(t.replace("_", " "))

    return Restaurant(
        place_id=place.get("id", ""),
        name=name,
        address=place.get("formattedAddress", ""),
        rating=place.get("rating"),
        rating_count=place.get("userRatingCount"),
        price_level=_price_level_map(place.get("priceLevel")),
        cuisine_types=cuisine_types,
        hours=_parse_opening_hours(place.get("currentOpeningHours")),
        website=place.get("websiteUri"),
        phone=place.get("nationalPhoneNumber"),
        photo_url=_parse_photo_url(place.get("photos"), api_key),
        reviews=_parse_reviews(place.get("reviews")),
        lat=lat,
        lng=lng,
    )


class GooglePlacesProvider:
    """Google Places API (New) adapter."""

    async def search(
        self,
        query: str,
        location: str,
        cuisines: list[str],
        price_tier: int | None,
    ) -> list[Restaurant]:
        settings = get_settings()
        if not settings.google_places_api_key:
            log.warning("google_places_no_key")
            return []

        # Build text query
        cuisine_str = " ".join(cuisines) if cuisines else ""
        text_query = f"{cuisine_str} {query} restaurant in {location}".strip()

        cache_key = hashlib.md5(text_query.encode()).hexdigest()
        cached = _cache_get(f"search:{cache_key}")
        if cached is not None:
            log.info("google_places_cache_hit", query=text_query)
            return cached

        payload: dict[str, Any] = {
            "textQuery": text_query,
            "maxResultCount": _MAX_RESULTS,
            "languageCode": "en",
        }

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": settings.google_places_api_key,
            "X-Goog-FieldMask": _SEARCH_FIELD_MASK,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{_PLACES_BASE}/places:searchText",
                    json=payload,
                    headers=headers,
                )

            if resp.status_code == 403:
                log.error("google_places_403", detail=resp.text[:200])
                return []
            if resp.status_code == 429:
                log.warning("google_places_429_search")
                return []
            resp.raise_for_status()

            data = resp.json()
            places = data.get("places", [])
            restaurants = [
                _place_to_restaurant(p, settings.google_places_api_key) for p in places
            ]
            # Filter out empty place_ids
            restaurants = [r for r in restaurants if r.place_id]

            _cache_set(f"search:{cache_key}", restaurants)
            log.info("google_places_search_done", count=len(restaurants), query=text_query)
            return restaurants

        except httpx.HTTPStatusError as exc:
            log.error("google_places_http_error", status=exc.response.status_code, error=str(exc))
            return []
        except Exception as exc:
            log.error("google_places_search_error", error=str(exc))
            return []

    async def details(self, place_id: str) -> Restaurant | None:
        settings = get_settings()
        if not settings.google_places_api_key:
            return None

        cache_key = f"details:{place_id}"
        cached = _cache_get(cache_key)
        if cached is not None:
            log.info("google_places_details_cache_hit", place_id=place_id)
            return cached

        headers = {
            "X-Goog-Api-Key": settings.google_places_api_key,
            "X-Goog-FieldMask": _DETAILS_FIELD_MASK,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{_PLACES_BASE}/places/{place_id}",
                    headers=headers,
                )

            if resp.status_code == 403:
                log.error("google_places_details_403", place_id=place_id, detail=resp.text[:200])
                return None
            if resp.status_code == 429:
                log.warning("google_places_429_details", place_id=place_id)
                return None
            if resp.status_code == 404:
                log.warning("google_places_details_404", place_id=place_id)
                return None
            resp.raise_for_status()

            place = resp.json()
            restaurant = _place_to_restaurant(place, settings.google_places_api_key)

            _cache_set(cache_key, restaurant)
            log.info("google_places_details_done", place_id=place_id)
            return restaurant

        except httpx.HTTPStatusError as exc:
            log.error(
                "google_places_details_http_error",
                place_id=place_id,
                status=exc.response.status_code,
                error=str(exc),
            )
            return None
        except Exception as exc:
            log.error("google_places_details_error", place_id=place_id, error=str(exc))
            return None
