from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM
    github_token: str = ""
    llm_base_url: str = "https://models.inference.ai.azure.com"
    llm_model: str = "gpt-4o-mini"
    llm_model_strong: str = "gpt-4o"

    # Google Places
    google_places_api_key: str = ""

    # Provider
    restaurant_provider: str = "google"  # "google" | "overpass"

    # Auth
    api_key: str = "strong_key"

    # CORS
    allowed_origin: str = "http://localhost:5173"

    # ChromaDB
    chroma_path: str = "./chroma_db"

    # Rate limiting
    rate_limit_per_minute: int = 10
    rate_limit_daily_global: int = 1000

    # Upload
    max_upload_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
