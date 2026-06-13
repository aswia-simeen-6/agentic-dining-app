# Dining Intelligence — Flow Review, Flaws & Deployment Hardening Plan

**Reviewed:** backend (FastAPI + LangGraph, 5 agents, ChromaDB RAG) and frontend (React + Vite).
**Verdict:** Solid demo, **not yet deployable**. There are two real correctness bugs in the agent flow, several security holes that make a public deployment dangerous (uncapped LLM cost, no auth/rate-limit, unbounded uploads), an SSE bug that silently re-runs the whole pipeline (re-billing), and no deployment artifacts (Docker, CI, persistence story, tests). Fix the P0/P1 items below before shipping.

> **Biggest product flaw:** the restaurants, reviews, and availability are entirely **invented by the LLM** and never validated. The product direction is now to **ground everything in live restaurant data** — see **Section 5** for the free-first redesign that replaces fabrication with real venues, real reviews, real menu links, and real booking deep-links.

---

## 1. How the flow actually works today

```
POST /api/query  ──►  compile_graph()  ──►  graph.ainvoke(state)
                                              │
   START → supervisor → parallel_analysis → recommendation → reservation → END
                          (menu ‖ review)
```

1. **Supervisor** — LLM parses the raw query into `intent`, `preferences`, `agents_activated`.
2. **parallel_analysis** — one node runs `menu_analyst` and `review_sentiment` concurrently with `asyncio.gather`.
3. **recommendation** — pulls RAG context from ChromaDB, then LLM ranks the 3 restaurants.
4. **reservation** — LLM builds a booking plan for the top pick.

The SSE endpoint (`GET /api/query/stream`) runs the same graph via `astream` and emits one event per node. The React `usePipeline` hook drives the UI in either blocking or streaming mode.

The architecture is reasonable. The problems are in the details.

---

## 2. Flaws & incorrect execution

### P0 — Blocks deployment (correctness + cost/safety)

**2.1 Review Sentinel runs in parallel with Menu Analyst and therefore never sees the restaurants it is meant to review.**
In `parallel_analysis_node`, both nodes are launched from the *same* initial state via `asyncio.gather`. `review_sentiment_node` reads `state.get("restaurants", [])` — which is still empty because `menu_analyst_node` hasn't returned yet. So the Review agent receives an empty list and hallucinates its own restaurants with its own `id`s. Those IDs (and names) won't reliably match the Menu Analyst's `r1/r2/r3`, which then breaks:
- the Recommendation step's cross-referencing of menu vs. sentiment,
- the frontend `nameOf(id)` lookup in `RecommendPanel`,
- the reservation step's `top_id` resolution.
**This is the single most important logic bug.** Review must run *after* Menu Analyst, not concurrently with it.

**2.2 Conditional routing is effectively dead / unsafe.**
The Supervisor prompt is told it may return a subset of agents (e.g. "just look up reviews" → only `reviewSentiment`). But `route_after_supervisor` only chooses between `parallel_analysis` and `recommendation`, and the graph then *always* runs `recommendation` and `reservation` regardless. If the LLM ever returns a subset that excludes both menu and review, the pipeline routes straight to `recommendation` with **no restaurants**, producing empty/garbage output instead of a graceful response. Routing is cosmetic and the prompt's promise isn't honored.

**2.3 SSE auto-reconnect silently re-runs the entire pipeline (re-billing the LLM).**
`EventSource` automatically reconnects whenever the server closes the connection. On the `complete` event the frontend sets `busy=false` but never calls `es.close()`. The server then closes the stream, `es.onerror` fires, an error is shown to the user, **and** EventSource reconnects — which re-triggers the full multi-agent run (4+ LLM calls) again, potentially in a loop. Every streaming query can cost 2× or more and flash a spurious error. Must `close()` on `complete` and distinguish "normal close" from a real error.

**2.4 No authentication, no rate limiting, no cost ceiling on LLM-calling endpoints.**
`/api/query` and `/api/query/stream` make 4 paid model calls per request and are fully public. Anyone who finds the URL can run up an unbounded OpenAI bill or DoS the service. This alone makes a public deploy reckless.

**2.5 `/api/menu/upload` is unauthenticated and unbounded.**
`await file.read()` loads the entire upload into memory with no size cap and no real content-type enforcement, then parses arbitrary PDFs. A few large files exhaust memory. No auth means anyone can pollute your RAG store.

### P1 — Robustness / reliability

**2.6 GZip middleware can break SSE.** `GZipMiddleware` buffers responses ≥1000 bytes; applied to a `text/event-stream` it can delay or corrupt streaming. Exclude SSE (or all streaming) from gzip.

**2.7 No timeouts, retries, or concurrency limits on LLM calls.** `chat_json` uses the AsyncOpenAI default; a slow/hung call stalls the request, a transient 429/5xx fails the whole node, and unbounded parallel calls under load trigger cascading rate limits. Add explicit timeout, bounded retry with backoff, and a global semaphore.

**2.8 "Cancel" doesn't cancel blocking requests.** In blocking mode there's no `AbortController`, so the Cancel button only stops streaming. The fetch (and its LLM calls) keeps running server-side.

**2.9 Graph is recompiled on every request.** `compile_graph()` is called inside both `run_query` and `stream_pipeline`. Compile once at startup and reuse.

**2.10 `session_id` is plumbed through but does nothing.** No checkpointer is attached to the graph, so there's no memory/threading. Either wire a checkpointer (e.g. for multi-turn) or stop advertising session continuity.

**2.11 Global exception handler leaks internals.** It returns `str(exc)` to the client. In production this exposes stack/internal detail; log it, return a generic message + correlation id.

**2.12 Silent degradation.** When an agent fails it appends to `errors` and returns empty, but the pipeline continues and the API returns `200` with empty panels. The frontend never surfaces `errors`. Partial failures look like "no results" to the user.

**2.13 Stale year in the reservation prompt.** The example date is hardcoded "Saturday, June 15, 2025"; the model tends to echo it. Today is 2026 — inject the real current date.

### P2 — Hygiene / correctness niggles

- **No `.gitignore`.** `.env`, `chroma_db/`, `node_modules/`, `.venv/`, `dist/` can all be committed — including secrets. Add one immediately.
- **`secret_key` is defined, defaults to `change_me_in_production`, and is never used.** Dead config with a weak default.
- **Doc mismatch.** README says "14 knowledge documents"; `SEED_DOCS` actually has 16.
- **Likely dependency bloat.** ChromaDB's `DefaultEmbeddingFunction` uses an ONNX MiniLM via `onnxruntime`, not `sentence-transformers`. The pinned `sentence-transformers` (which pulls in PyTorch, ~hundreds of MB) appears unused — verify and drop it to shrink the image dramatically.
- **Very old `langgraph==0.1.9`.** Far behind current releases; plan a controlled upgrade (API has changed).
- **Verify the GitHub Models base URL.** `https://models.inference.ai.azure.com` may be outdated; confirm before relying on it.
- **`response_format={"type":"json_object"}`** isn't supported by every model/endpoint (notably some GitHub Models); guard for providers that reject it.

### Deployment gaps (nothing exists yet)

- No Dockerfile / docker-compose / Procfile; README only shows `uvicorn --reload` (dev).
- No production server config (Gunicorn/Uvicorn workers, proxy headers).
- **ChromaDB `PersistentClient` writes to local `./chroma_db`** — lost on every container redeploy, and unsafe with >1 instance. Needs a persistent volume or an external vector store.
- **Cold-start model download.** `DefaultEmbeddingFunction` downloads the embedding model on first use; bake it into the image instead.
- Frontend has no build/deploy story, no documented `VITE_API_URL`, no nginx/static hosting config.
- `/api/health` is a static liveness stub — it doesn't check LLM or vector-store reachability (no readiness probe).
- No tests, no CI, no linting.

---

## 3. Remediation plan (phased)

### Phase 0 — Make the flow correct (do first)
1. **Sequence the agents:** `supervisor → menu_analyst → review_sentiment → recommendation → reservation`. Keep them as separate LangGraph nodes with normal edges; pass the Menu Analyst's restaurant list (ids + names) explicitly into the Review prompt so IDs align. If you want genuine parallelism later, use LangGraph's real fan-out and reconcile by id — but correctness first.
2. **Fix routing:** either remove the conditional edge and run the full chain, or make `route_after_supervisor` honor `agents_activated` *and* guarantee `recommendation` only runs when restaurants exist (add a guard node / early-return with a friendly message).
3. **Enforce ID contract:** instruct each agent to preserve `r1/r2/r3`; after Menu Analyst, validate and renumber ids server-side so downstream never depends on the LLM getting it right.

### Phase 1 — Reliability
4. Add `timeout`, bounded `max_retries` with exponential backoff, and a global `asyncio.Semaphore` around all `chat_json` calls.
5. Compile the graph **once** in `lifespan`; reuse it in both endpoints.
6. Surface `errors` to the API response status and to the UI (show a banner when any agent failed).
7. Inject the real current date into the reservation (and supervisor) prompts.
8. Exclude SSE from GZip; on the frontend, `close()` the EventSource on `complete` and only show an error for genuine failures.
9. Add an `AbortController` to the blocking fetch so Cancel actually cancels.

### Phase 2 — Security
10. Put `/api/query`, `/api/query/stream`, `/api/menu/upload` behind an API key (or session auth) and a rate limiter (e.g. SlowAPI / a reverse-proxy limit). Add a per-IP and global daily request cap to bound LLM spend.
11. Cap upload size (stream to a temp file, reject >N MB), enforce content-type, and require auth.
12. Tighten CORS to the real frontend origin; remove the hardcoded `Access-Control-Allow-Origin: *` on the SSE response. Make the global error handler return a generic message + log the detail server-side.
13. Add `.gitignore` (secrets, `chroma_db/`, `node_modules/`, `.venv/`, `dist/`); rotate any key that may have been committed; remove the unused `secret_key` or give it a real purpose.

### Phase 3 — Deployment artifacts
14. **Backend Dockerfile** (multi-stage): install deps, **pre-download the embedding model at build time**, run under Gunicorn+Uvicorn workers. Drop `sentence-transformers` if confirmed unused.
15. **Vector store:** mount a persistent volume for `chroma_db`, or move to a hosted vector DB so data survives redeploys and scales past one instance.
16. **Frontend:** `vite build` → static host (Netlify/Vercel/S3+CDN or an nginx container); document `VITE_API_URL`; add a backend Dockerfile/nginx if co-hosting.
17. **docker-compose** for local parity (backend + frontend + volume).
18. **Readiness probe:** extend `/api/health` to check the LLM key/endpoint and Chroma; keep a separate cheap liveness route.
19. **Observability:** structured JSON logs, request ids, basic metrics (latency, per-agent failures, token usage).

### Phase 4 — Quality gates
20. Tests: unit tests per agent (mock the LLM), an integration test for the graph with a stubbed model, a frontend smoke test. Add CI (lint + test on PR). Plan the `langgraph`/`langchain` upgrade behind that test suite.

---

## 5. Turning it into a real product: live-data architecture (free-first)

**Decisions:** primary data source must be **free**; menus = **provider link + uploaded-menu RAG**; reservations = **deep-link + draft** (no fake slots).

### 5.1 The core trade-off (important)
Free APIs give you **real restaurants** (names, addresses, cuisine, hours, website, price tier). They do **not** give you free **reviews/ratings** — those are the paywalled part everywhere. So a truly $0 build can show real venues but cannot show real star ratings/review text. There are two honest ways to handle this:

- **Path A — Google Places API (New), pay-as-you-go, kept under the free cap (recommended).** Essentials SKUs include **10,000 free requests/month per SKU**, and Place Details returns a real rating, `userRatingCount`, and up to **5 reviews**. For an MVP at low volume this is effectively free *and* is the only free-at-low-volume source that includes real reviews. Cost: requires a billing account + key; strict ToS — you may **persist only `place_id`**, must cache details with a short TTL, and must **display review author attributions** (name, photo, profile link). Add hard usage caps so you never cross the free threshold.
- **Path B — OpenStreetMap (Overpass) or Geoapify, truly $0, no billing.** Overpass is keyless, ~10k requests/day/IP, returns name/address/cuisine/hours/website. **No ratings, reviews, or photos.** In this path the "Review Sentinel" stops pretending to score sentiment and instead surfaces only real signals (price tier, hours, distance) — fully honest, just thinner.

**Recommendation:** start on **Path A** (Google Places New, free-tier-bounded) because it preserves the review/rating feature for free at MVP scale; keep an **Overpass/Geoapify adapter** behind the same interface as a $0 fallback and for venue coverage. Foursquare's free Pro allowance drops to ~500 calls/month from June 1 2026 and bills photos/ratings as Premium, so it's a weaker free primary; Yelp has no real free tier.

### 5.2 Redesigned pipeline (LLM ranks real data; it never invents it)
```
supervisor → discovery → enrich(reviews/details) → recommendation → reservation
```
1. **Supervisor** — unchanged role (extract preferences); add geocoding of the location to lat/lng for the search call.
2. **Discovery** *(replaces the fabricating Menu Analyst)* — call the data provider (Places text/nearby search filtered by cuisine, location, price level) → a candidate set of **real** venues. **`place_id` becomes the stable ID end-to-end**, which also fixes the old cross-agent ID-mismatch bug.
3. **Enrich** *(replaces the fabricating Review Sentinel)* — fetch Place Details: rating, rating count, hours, website, price level, and real review excerpts. The LLM's job is to **summarize the real reviews into themes** (and must show attributions), not to make up scores. On Path B, this node reports real attributes only.
4. **Menu** — surface the official **menu/website link** from the provider; if a menu PDF was uploaded for that venue, retrieve it from the RAG store and let the LLM summarize *that real menu*. **Never invent dishes or prices.**
5. **Recommendation** — LLM ranks the **real** candidates using preferences + RAG knowledge + real ratings/review-summaries; outputs explanations only. Validate with Pydantic.
6. **Reservation** — build a **Reserve-with-Google / OpenTable search deep-link** for the chosen venue plus a copy-ready draft message. No fabricated "available slots." (Real-time availability later via OpenTable Connect partner approval.)

### 5.3 Grounding & validation layer (the fix for "it should not be there")
- **Trust boundary:** factual fields (name, address, rating, price, hours, links, review text) come **only** from the provider API. The LLM may *rank, summarize, and draft* — it may not originate facts.
- **Schema-validate every LLM output** with Pydantic (counts, required fields, IDs that must match the provider's `place_id`s, no extra venues). Reject/repair on failure instead of passing it through.
- **Provider adapter interface** (`search()`, `details()`) so Google/Overpass/Foursquare are swappable and testable with recorded fixtures.

### 5.4 Compliance & cost control (so "free" stays free and legal)
- **ToS:** on Google, persist only `place_id`; cache details with a short TTL; render review attributions; don't store review text long-term.
- **Quota safety:** cache by `place_id` + normalized query; cap candidates (≈5–8); minimize Place Details calls; add a daily request counter that hard-stops before the free cap. The auth + rate-limit + daily-cap work from Phase 2 now also protects your free Places quota, not just the LLM bill.

### 5.5 Revised build order (supersedes Phase 0)
1. Build the **provider adapter** (Google Places New first; Overpass fallback) with fixtures.
2. Replace **Discovery** and **Enrich** nodes to consume real data; make `place_id` the ID everywhere.
3. Add the **Pydantic validation/grounding layer**; remove all "invent a restaurant/review/slot" prompting.
4. Wire **menu link + uploaded-menu RAG**; **reservation deep-link + draft**.
5. Then proceed to Phases 1–4 (reliability, security, deployment, tests) from Section 3 — several of which (rate-limit, caching, caps) now double as Places-quota protection.

---

## 4. Pre-deploy checklist (must be green)

- [ ] Restaurants/reviews/availability come from a live provider — **nothing about real venues is LLM-invented**
- [ ] `place_id` is the stable ID end-to-end; all LLM JSON is Pydantic-validated against provider data
- [ ] Google ToS honored (store only `place_id`, short-TTL cache, review attributions shown) **or** running the $0 Overpass path
- [ ] Daily request cap stops before the free Places quota is exceeded
- [ ] Menus = provider link + uploaded-menu RAG only; reservations = deep-link + draft (no fake slots)
- [ ] Recommendation never runs on empty restaurants
- [ ] SSE closes on completion; no pipeline re-runs; errors are real
- [ ] Auth + rate limit + daily cost cap on all LLM/upload endpoints
- [ ] Upload size/type capped; uploads authenticated
- [ ] LLM timeouts + retries + concurrency cap
- [ ] CORS locked to frontend origin; error handler doesn't leak internals
- [ ] `.gitignore` present; no secrets in git; keys rotated if needed
- [ ] Graph compiled once; embedding model baked into image
- [ ] Persistent (or external) vector store
- [ ] Backend + frontend Dockerfiles; readiness probe; structured logs
- [ ] Minimal test suite + CI passing
```
