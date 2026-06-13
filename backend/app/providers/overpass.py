from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.models import Restaurant

log = structlog.get_logger()

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_MAX_RESULTS = 8
_RADIUS_METERS = 2000


async def _geocode(location: str) -> tuple[float, float] | None:
    """Convert location string to (lat, lng) using Nominatim."""
    params = {
        "q": location,
        "format": "json",
        "limit": 1,
    }
    headers = {"User-Agent": "AgenticDining/1.0 (mehulpoddar1310@gmail.com)"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(_NOMINATIM_URL, params=params, headers=headers)
            resp.raise_for_status()
            results = resp.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        log.warning("overpass_geocode_error", location=location, error=str(exc))
    return None


def _build_overpass_query(lat: float, lng: float, cuisines: list[str]) -> str:
    cuisine_filter = ""
    if cuisines:
        # Match on cuisine tag
        cuisine_values = "|".join(cuisines)
        cuisine_filter = f'["cuisine"~"{cuisine_values}",i]'

    return f"""
[out:json][timeout:15];
(
  node["amenity"="restaurant"]{cuisine_filter}(around:{_RADIUS_METERS},{lat},{lng});
  way["amenity"="restaurant"]{cuisine_filter}(around:{_RADIUS_METERS},{lat},{lng});
);
out body center {_MAX_RESULTS};
"""


def _element_to_restaurant(element: dict[str, Any]) -> Restaurant | None:
    tags = element.get("tags", {})
    name = tags.get("name")
    if not name:
        return None

    # Build a stable place_id from OSM element type + id
    osm_type = element.get("type", "node")
    osm_id = element.get("id", 0)
    place_id = f"osm:{osm_type}:{osm_id}"

    # Address
    addr_parts = []
    for key in ("addr:housenumber", "addr:street", "addr:city", "addr:country"):
        val = tags.get(key)
        if val:
            addr_parts.append(val)
    address = ", ".join(addr_parts) if addr_parts else tags.get("addr:full", "")

    # Cuisine
    cuisine_raw = tags.get("cuisine", "")
    cuisine_types = [c.strip() for c in cuisine_raw.replace(";", ",").split(",") if c.strip()]

    # Hours
    hours = tags.get("opening_hours")

    # Phone / website
    phone = tags.get("phone") or tags.get("contact:phone")
    website = tags.get("website") or tags.get("contact:website")

    # Location — use center for ways, lat/lon for nodes
    if "center" in element:
        lat = element["center"].get("lat")
        lng = element["center"].get("lon")
    else:
        lat = element.get("lat")
        lng = element.get("lon")

    return Restaurant(
        place_id=place_id,
        name=name,
        address=address,
        rating=None,       # OSM does not provide ratings
        rating_count=None,
        price_level=None,  # OSM does not provide price levels
        cuisine_types=cuisine_types,
        hours=hours,
        website=website,
        phone=phone,
        photo_url=None,
        reviews=[],
        lat=float(lat) if lat is not None else None,
        lng=float(lng) if lng is not None else None,
    )


class OverpassProvider:
    """OpenStreetMap Overpass API fallback provider. No ratings or reviews."""

    async def search(
        self,
        query: str,
        location: str,
        cuisines: list[str],
        price_tier: int | None,
    ) -> list[Restaurant]:
        coords = await _geocode(location)
        if coords is None:
            log.warning("overpass_geocode_failed", location=location)
            return []

        lat, lng = coords
        overpass_query = _build_overpass_query(lat, lng, cuisines)

        headers = {"User-Agent": "AgenticDining/1.0 (mehulpoddar1310@gmail.com)"}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    _OVERPASS_URL,
                    data={"data": overpass_query},
                    headers=headers,
                )
                resp.raise_for_status()

            data = resp.json()
            elements = data.get("elements", [])

            restaurants: list[Restaurant] = []
            for element in elements:
                r = _element_to_restaurant(element)
                if r:
                    restaurants.append(r)
                if len(restaurants) >= _MAX_RESULTS:
                    break

            log.info("overpass_search_done", count=len(restaurants), location=location)
            return restaurants

        except httpx.HTTPStatusError as exc:
            log.error("overpass_http_error", status=exc.response.status_code, error=str(exc))
            return []
        except Exception as exc:
            log.error("overpass_search_error", error=str(exc))
            return []

    async def details(self, place_id: str) -> Restaurant | None:
        """Overpass does not support individual place detail lookups by OSM ID efficiently.
        Return None — enrich node will keep the data from search."""
        log.debug("overpass_details_noop", place_id=place_id)
        return None
