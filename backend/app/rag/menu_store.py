from __future__ import annotations

import hashlib

import structlog

from app.config import get_settings

log = structlog.get_logger()

_CHUNK_SIZE = 500      # characters per chunk
_CHUNK_OVERLAP = 50   # characters of overlap between chunks
_N_RESULTS = 3        # number of chunks to retrieve per query


def _chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks: list[str] = []
    start = 0
    text = text.strip()
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def get_collection():
    """Return (or create) the ChromaDB menus collection."""
    import chromadb
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

    settings = get_settings()
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_or_create_collection(
        "menus",
        embedding_function=DefaultEmbeddingFunction(),
    )


async def add_menu(place_id: str, text: str) -> None:
    """Chunk menu text and index it into ChromaDB with place_id metadata."""
    if not text or not text.strip():
        log.warning("add_menu_empty_text", place_id=place_id)
        return

    chunks = _chunk_text(text)
    if not chunks:
        log.warning("add_menu_no_chunks", place_id=place_id)
        return

    collection = get_collection()

    # Build IDs, documents, and metadata
    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict] = []

    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5(f"{place_id}:{i}:{chunk[:50]}".encode()).hexdigest()
        ids.append(chunk_id)
        documents.append(chunk)
        metadatas.append({"place_id": place_id, "chunk_index": i})

    # Delete existing chunks for this place_id before re-indexing
    try:
        existing = collection.get(where={"place_id": place_id})
        if existing and existing.get("ids"):
            collection.delete(ids=existing["ids"])
    except Exception as exc:
        log.warning("add_menu_delete_existing_error", place_id=place_id, error=str(exc))

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    log.info("add_menu_done", place_id=place_id, chunks=len(chunks))


async def query_menu(place_id: str, query: str) -> str | None:
    """Retrieve relevant menu chunks for a given place_id and query."""
    if not query or not query.strip():
        return None

    try:
        collection = get_collection()

        results = collection.query(
            query_texts=[query],
            n_results=_N_RESULTS,
            where={"place_id": place_id},
        )

        docs = results.get("documents", [[]])[0]
        if not docs:
            log.debug("query_menu_no_results", place_id=place_id, query=query)
            return None

        combined = "\n\n".join(docs)
        log.info("query_menu_done", place_id=place_id, chunks_returned=len(docs))
        return combined

    except Exception as exc:
        log.error("query_menu_error", place_id=place_id, error=str(exc))
        return None
