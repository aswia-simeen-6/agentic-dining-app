from __future__ import annotations

from abc import ABC, abstractmethod

from app.models import Restaurant


class RestaurantProvider(ABC):
    """Abstract interface for restaurant data providers."""

    @abstractmethod
    async def search(
        self,
        query: str,
        location: str,
        cuisines: list[str],
        price_tier: int | None,
    ) -> list[Restaurant]:
        """Search for restaurants matching the criteria. Returns up to 8 results."""
        ...

    @abstractmethod
    async def details(self, place_id: str) -> Restaurant | None:
        """Fetch detailed information (including reviews) for a single restaurant."""
        ...


def get_provider() -> RestaurantProvider:
    """Factory: return configured provider instance."""
    from app.config import get_settings

    settings = get_settings()
    if settings.restaurant_provider == "google":
        from app.providers.google_places import GooglePlacesProvider

        return GooglePlacesProvider()

    from app.providers.overpass import OverpassProvider

    return OverpassProvider()
