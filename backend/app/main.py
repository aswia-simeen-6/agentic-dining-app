from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import router
from app.config import get_settings
from app.graph.pipeline import get_graph

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: compile graph once at startup."""
    log.info("startup_begin")
    try:
        get_graph()
        log.info("graph_compiled")
    except Exception as exc:
        log.error("graph_compile_error", error=str(exc))
        # Allow startup to continue — graph will retry on first request
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Agentic Dining",
        description="AI-powered dining recommendation and reservation assistant.",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS — locked to configured origin
    # Note: allow_credentials=True + allow_headers=["*"] is invalid per CORS spec;
    # browser strips wildcard headers on credentialed requests. Enumerate explicitly.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.allowed_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-API-Key"],
    )

    # Rate limiting via SlowAPI
    limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # API routes
    app.include_router(router, prefix="/api")

    # Global exception handler — no internal details leaked to client
    @app.exception_handler(Exception)
    async def global_error_handler(request: Request, exc: Exception) -> JSONResponse:
        cid = str(uuid.uuid4())[:8]
        log.error(
            "unhandled_error",
            error=str(exc),
            error_type=type(exc).__name__,
            path=str(request.url.path),
            correlation_id=cid,
        )
        return JSONResponse(
            status_code=500,
            content={"error": "internal error", "correlation_id": cid},
        )

    return app


app = create_app()
