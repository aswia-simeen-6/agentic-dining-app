from __future__ import annotations

import uuid

from pydantic import BaseModel, Field, field_validator


class ReviewSnippet(BaseModel):
    author_name: str
    author_url: str = ""
    text: str
    rating: int
    relative_time: str = ""


class Restaurant(BaseModel):
    place_id: str
    name: str
    address: str = ""
    rating: float | None = None
    rating_count: int | None = None
    price_level: int | None = None  # 1-4
    cuisine_types: list[str] = Field(default_factory=list)
    hours: str | None = None
    website: str | None = None
    phone: str | None = None
    photo_url: str | None = None
    reviews: list[ReviewSnippet] = Field(default_factory=list)
    lat: float | None = None
    lng: float | None = None
    menu_summary: str | None = None

    @field_validator("price_level")
    @classmethod
    def validate_price_level(cls, v: int | None) -> int | None:
        if v is not None and v not in (1, 2, 3, 4):
            return None
        return v

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 5.0):
            return None
        return v


class SupervisorOutput(BaseModel):
    query_clean: str
    location: str
    cuisine_preferences: list[str] = Field(default_factory=list)
    price_tier: int | None = None  # 1-4 or None
    party_size: int = 2
    special_requests: str = ""
    agents_activated: list[str] = Field(default_factory=list)

    @field_validator("price_tier")
    @classmethod
    def validate_price_tier(cls, v: int | None) -> int | None:
        if v is not None and v not in (1, 2, 3, 4):
            return None
        return v


class RankedRestaurant(BaseModel):
    place_id: str
    rank: int  # 1-3
    reason: str


class RecommendationResult(BaseModel):
    ranked: list[RankedRestaurant]
    explanation: str


class ReservationResult(BaseModel):
    place_id: str
    name: str
    deep_link: str
    opentable_url: str | None = None
    draft_message: str


class QueryRequest(BaseModel):
    query: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class QueryResponse(BaseModel):
    session_id: str
    restaurants: list[Restaurant] = Field(default_factory=list)
    recommendation: RecommendationResult | None = None
    reservation: ReservationResult | None = None
    errors: list[str] = Field(default_factory=list)
    current_step: str = ""
