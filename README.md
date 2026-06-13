# Agentic Dining

AI-powered restaurant discovery and reservation assistant. Finds real restaurants via Google Places, ranks them with LLM agents, and helps you book.

**Live:** https://agentic-dining-frontend.onrender.com

---

## What it does

Type a dining query like *"romantic Italian in NYC for 2"* and a multi-agent pipeline runs in real time:

1. **Supervisor** — parses intent, location, cuisine, party size
2. **Discovery** — searches Google Places API for real venues
3. **Enrich** — fetches real ratings, reviews, hours, photos
4. **Recommendation** — LLM ranks candidates against your preferences
5. **Reservation** — builds a Google Maps deep-link + OpenTable search + draft inquiry message

No invented data. Every restaurant, rating, and review comes from Google Places.

---

## Features

- Live streaming pipeline with per-step progress messages
- Interactive map (Leaflet + OpenStreetMap) with ranked pins
- Side-by-side comparison table (rating, price, cuisine, hours)
- Share results via `/r/{session_id}` URL (24hr link)
- Location auto-detect (browser geolocation → Nominatim reverse geocode)
- PDF menu upload → RAG-powered menu summaries
- OpenTable search link + Google Maps reserve link
- Dark mode, mobile-first, installable PWA

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, LangGraph 0.2+, Pydantic v2 |
| Agents | GitHub Models (GPT-4o / GPT-4o-mini) — free tier |
| Data | Google Places API (New) + OpenStreetMap Overpass fallback |
| Vector store | ChromaDB (menu RAG) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Map | Leaflet + OpenStreetMap (no API key) |
| Deployment | Render (backend Docker + frontend static site) |

---

## Local setup

### Prerequisites
- Python 3.12+
- Node 20+
- GitHub token (for free LLM via GitHub Models)
- Google Places API key (Places API New enabled)

### 1. Clone + env

```bash
git clone https://github.com/aswia-simeen-6/agentic-dining-app.git
cd agentic-dining-app
cp .env.example .env
```

Edit `.env`:
```
GITHUB_TOKEN=ghp_...
GOOGLE_PLACES_API_KEY=AIza...
API_KEY=your-random-secret
ALLOWED_ORIGIN=http://localhost:5173
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`
Docs at `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
```

Create `frontend/.env.local`:
```
VITE_API_KEY=same_value_as_API_KEY_above
VITE_API_URL=
```

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Project structure

```
agentic_dining/
├── backend/
│   ├── app/
│   │   ├── agents/          # supervisor, discovery, enrich, recommendation, reservation
│   │   ├── api/             # FastAPI routes, deps, middleware
│   │   ├── graph/           # LangGraph state + pipeline
│   │   ├── providers/       # Google Places + Overpass adapters
│   │   ├── rag/             # ChromaDB menu store
│   │   ├── config.py
│   │   ├── llm.py           # chat_json() with retry + semaphore
│   │   ├── models.py        # Pydantic v2 schemas
│   │   └── main.py
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/      # SearchBar, MapView, RestaurantCard, ComparisonTable,
│   │   │                    # RecommendPanel, ReservationPanel, ShareButton, EmptyState...
│   │   ├── hooks/           # usePipeline (SSE state management)
│   │   ├── lib/             # API client (fetch streaming, no EventSource)
│   │   └── types/           # TypeScript API contracts
│   ├── public/
│   │   ├── manifest.json    # PWA manifest
│   │   └── sw.js            # Service worker
│   ├── Dockerfile
│   └── vite.config.ts
├── .github/workflows/ci.yml
├── docker-compose.yml
└── .env.example
```

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/query` | ✅ | Blocking pipeline run |
| `GET` | `/api/query/stream` | ✅ | SSE streaming pipeline |
| `GET` | `/api/results/{session_id}` | ✅ | Retrieve stored results (share links) |
| `POST` | `/api/menu/upload` | ✅ | Upload PDF menu for RAG |
| `GET` | `/api/health` | — | Readiness (checks LLM key + Chroma) |
| `GET` | `/api/alive` | — | Liveness probe |

Auth: `X-API-Key` header.

---

## Deploy to Render

### Backend — Web Service (Docker)
- Root directory: `backend`
- Environment: Docker
- Port: `8000`
- Health check: `/api/alive`

Environment variables:
```
GITHUB_TOKEN, GOOGLE_PLACES_API_KEY, API_KEY,
ALLOWED_ORIGIN=https://your-frontend.onrender.com,
RESTAURANT_PROVIDER=google, CHROMA_PATH=./chroma_db,
LLM_MODEL=gpt-4o-mini, LLM_MODEL_STRONG=gpt-4o,
LLM_BASE_URL=https://models.inference.ai.azure.com
```

### Frontend — Static Site
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

Environment variables:
```
VITE_API_URL=https://your-backend.onrender.com
VITE_API_KEY=same_as_backend_API_KEY
```

### Docker Compose (local parity)
```bash
cp .env.example .env  # fill in secrets
docker-compose up
```

---

## Design decisions

- **No EventSource** — uses `fetch` + `ReadableStream` for SSE so `X-API-Key` header can be sent (EventSource doesn't support custom headers)
- **Sequential agents** — review runs after discovery, not in parallel, so it has actual restaurant data to work with
- **place_id as canonical ID** — Google Places `place_id` flows end-to-end, preventing cross-agent ID mismatch
- **LLM never invents facts** — only ranks, summarizes, and drafts; all venue data comes from provider API
- **Pydantic v2 validation** on all LLM output — unknown place_ids rejected before reaching the UI

---

## License

MIT
