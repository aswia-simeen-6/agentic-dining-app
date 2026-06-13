from __future__ import annotations

from fastapi import Header, HTTPException

from app.config import get_settings


async def require_api_key(x_api_key: str = Header("", alias="X-API-Key")) -> str:
    settings = get_settings()
    if not x_api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key
