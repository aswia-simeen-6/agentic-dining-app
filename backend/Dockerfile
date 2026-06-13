# Stage 1: deps + model download
FROM python:3.12-slim AS builder
WORKDIR /build
COPY pyproject.toml .
# Copy app so hatchling can find the package
COPY app/ ./app/
RUN pip install --upgrade pip && pip install --no-cache-dir ".[dev]"
# Pre-download ChromaDB embedding model at build time (no cold-start)
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; DefaultEmbeddingFunction()([])"

# Stage 2: runtime
FROM python:3.12-slim AS runtime
WORKDIR /app
# Copy installed packages and model cache from builder
COPY --from=builder /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /root/.cache /root/.cache
COPY app/ ./app/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--forwarded-allow-ips", "*"]
