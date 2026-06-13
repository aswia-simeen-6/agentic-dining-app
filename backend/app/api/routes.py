from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.deps import require_api_key
from app.config import get_settings
from app.graph.pipeline import get_graph
from app.graph.state import PipelineState
from app.middleware.security import get_correlation_id
from app.models import QueryRequest, QueryResponse

log = structlog.get_logger()

router = APIRouter()


def _state_to_response(state: PipelineState, session_id: str) -> QueryResponse:
    return QueryResponse(
        session_id=session_id,
        restaurants=state.get("enriched_restaurants") or state.get("restaurants", []),
        recommendation=state.get("recommendation"),
        reservation=state.get("reservation"),
        errors=state.get("errors", []),
        current_step=state.get("current_step", ""),
    )


def _initial_state(request_data: QueryRequest) -> PipelineState:
    return PipelineState(
        query=request_data.query,
        session_id=request_data.session_id,
        supervisor_output=None,
        restaurants=[],
        enriched_restaurants=[],
        recommendation=None,
        reservation=None,
        errors=[],
        current_step="init",
    )


# ---------------------------------------------------------------------------
# POST /api/query — blocking (waits for full pipeline)
# ---------------------------------------------------------------------------
@router.post("/query", response_model=QueryResponse, dependencies=[Depends(require_api_key)])
async def query_blocking(request_data: QueryRequest, request: Request) -> QueryResponse:
    cid = get_correlation_id()
    log.info("query_start", session_id=request_data.session_id, correlation_id=cid)

    graph = get_graph()
    initial = _initial_state(request_data)

    try:
        final_state: PipelineState = await graph.ainvoke(initial)
    except Exception as exc:
        log.error("query_pipeline_error", error=str(exc), correlation_id=cid)
        raise HTTPException(status_code=500, detail="Pipeline execution failed") from exc

    response = _state_to_response(final_state, request_data.session_id)
    log.info(
        "query_done",
        session_id=request_data.session_id,
        step=response.current_step,
        errors=len(response.errors),
        correlation_id=cid,
    )
    return response


# ---------------------------------------------------------------------------
# GET /api/query/stream — SSE streaming
# ---------------------------------------------------------------------------
async def _stream_pipeline(initial: PipelineState, session_id: str) -> AsyncGenerator[str, None]:
    """Yield SSE events per step; final 'complete' event carries full QueryResponse."""
    graph = get_graph()
    final_state: PipelineState | None = None

    try:
        # stream_mode="values" yields full accumulated state after each node
        async for state in graph.astream(initial, stream_mode="values"):
            final_state = state
            step = state.get("current_step", "")
            if not step:
                continue
            data = {
                "type": "step",
                "step": step,
                "data": {
                    "errors": state.get("errors", []),
                    "restaurant_count": len(
                        state.get("enriched_restaurants") or state.get("restaurants", [])
                    ),
                },
            }
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0)

        if final_state is not None:
            response = _state_to_response(final_state, session_id)
            yield f"data: {json.dumps({'type': 'complete', 'data': response.model_dump()})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Pipeline produced no output'})}\n\n"

    except Exception as exc:
        log.error("sse_pipeline_error", error=str(exc))
        yield f"data: {json.dumps({'type': 'error', 'message': 'Pipeline error'})}\n\n"


@router.get("/query/stream", dependencies=[Depends(require_api_key)])
async def query_stream(
    query: str,
    session_id: str | None = None,
    request: Request = None,
) -> StreamingResponse:
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="'query' parameter is required")

    sid = session_id or str(uuid.uuid4())
    log.info("sse_start", session_id=sid)

    request_data = QueryRequest(query=query, session_id=sid)
    initial = _initial_state(request_data)

    return StreamingResponse(
        _stream_pipeline(initial, sid),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
            "Content-Encoding": "identity",  # prevent GZip compression
        },
    )


# ---------------------------------------------------------------------------
# POST /api/menu/upload — PDF menu indexing
# ---------------------------------------------------------------------------
@router.post("/menu/upload", dependencies=[Depends(require_api_key)])
async def upload_menu(
    place_id: str,
    file: UploadFile,
    request: Request = None,
) -> JSONResponse:
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024

    # Validate content type
    content_type = (file.content_type or "").lower()
    if "pdf" not in content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF uploads are accepted (got '{file.content_type}')",
        )

    # Read in chunks, enforce size limit
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(65536)  # 64 KB chunks
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum size of {settings.max_upload_mb} MB",
            )
        chunks.append(chunk)

    raw_bytes = b"".join(chunks)

    # Parse PDF text
    try:
        import io

        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n".join(pages_text).strip()
    except Exception as exc:
        log.error("menu_upload_pdf_parse_error", place_id=place_id, error=str(exc))
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {exc}") from exc

    if not full_text:
        raise HTTPException(status_code=422, detail="PDF contains no extractable text.")

    # Index into ChromaDB
    from app.rag.menu_store import add_menu

    try:
        await add_menu(place_id=place_id, text=full_text)
    except Exception as exc:
        log.error("menu_upload_index_error", place_id=place_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to index menu.") from exc

    log.info("menu_upload_done", place_id=place_id, chars=len(full_text))
    return JSONResponse(
        content={
            "status": "indexed",
            "place_id": place_id,
            "pages": len(pages_text),
            "chars": len(full_text),
        }
    )


# ---------------------------------------------------------------------------
# GET /api/health — readiness check
# ---------------------------------------------------------------------------
@router.get("/health")
async def health() -> JSONResponse:
    settings = get_settings()
    checks: dict[str, str] = {}

    # LLM key
    if settings.github_token:
        checks["llm_key"] = "ok"
    else:
        checks["llm_key"] = "missing"

    # ChromaDB
    try:
        from app.rag.menu_store import get_collection

        get_collection()
        checks["chroma"] = "ok"
    except Exception as exc:
        checks["chroma"] = f"error: {exc}"

    status_code = 200 if all(v == "ok" for v in checks.values()) else 503
    return JSONResponse(content={"status": "ok" if status_code == 200 else "degraded", "checks": checks}, status_code=status_code)


# ---------------------------------------------------------------------------
# GET /api/alive — liveness probe
# ---------------------------------------------------------------------------
@router.get("/alive")
async def alive() -> JSONResponse:
    return JSONResponse(content={"status": "alive"}, status_code=200)
