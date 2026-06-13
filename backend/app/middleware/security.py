from __future__ import annotations

import uuid

from fastapi import Header, HTTPException

from app.config import get_settings


async def require_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> str:
    """FastAPI dependency: validates X-API-Key header. Raises 401 on failure."""
    settings = get_settings()
    if not x_api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return x_api_key


def get_correlation_id() -> str:
    """Generate a short UUID for request correlation / tracing."""
    return str(uuid.uuid4())[:8]
