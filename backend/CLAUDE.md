# Backend CLAUDE.md

> Read the root `../CLAUDE.md` first. This file covers backend-specific details only.

---

## Runtime — Python 3.11 Venv (Critical)

**Always use the `.venv` inside this folder. Never use global Python.**

```bash
# Create (one-time)
"C:\Users\Farrel's Laptop\AppData\Local\Programs\Python\Python311\python.exe" -m venv .venv

# Activate (every terminal session)
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux

# Install
pip install -r requirements.txt

# Run
python -m uvicorn app.main:app --reload
```

Do NOT run with Python 3.13 (the global default on this machine). The pinned packages require 3.11 pre-built wheels. On 3.13, `pymupdf==1.24.5` and `pydantic==2.7.1` fail to install because they need Visual Studio Build Tools and meson breaks on the path apostrophe.

---

## Folder Structure

```
backend/
├── app/
│   ├── main.py                  FastAPI app + CORS + router registration + lifespan
│   ├── core/
│   │   ├── config.py            Pydantic Settings — all env vars loaded here
│   │   └── auth.py              Verifies NextAuth session token via HTTP to frontend
│   ├── api/
│   │   ├── deps.py              current_user dependency (extracts Bearer token)
│   │   └── routes/
│   │       ├── health.py        GET /api/health, GET /api/me
│   │       ├── chat.py          GET/DELETE conversations, POST /api/chat/stream (SSE)
│   │       ├── anki.py          POST generate, GET decks/cards, DELETE deck
│   │       ├── pdf.py           POST upload, POST summarize (SSE)
│   │       └── rag.py           POST ingest, GET status
│   ├── agents/
│   │   ├── search_agent.py      DuckDuckGo search → stream synthesised answer
│   │   └── anki_agent.py        Kimi-K2.5 → JSON Anki cards → sanitise/dedup
│   ├── rag/
│   │   ├── embeddings.py        Singleton HuggingFace all-MiniLM-L6-v2
│   │   ├── vector_store.py      Singleton ChromaDB persistent client + retrieve_context()
│   │   └── pdf_processor.py     .txt + .pdf → Document chunks; ingest_knowledge_base()
│   ├── services/
│   │   ├── llm.py               get_llm() → ChatNVIDIA; stream_response() async generator
│   │   ├── chat_service.py      Supabase CRUD for conversations + messages; context builder
│   │   └── anki_service.py      Supabase CRUD for decks + cards
│   └── db/
│       ├── supabase.py          Singleton Supabase client (service_role key)
│       └── models.py            Pydantic request/response + DB row models
├── knowledge_base/              Drop .txt/.pdf files here for RAG ingest
├── chroma_db/                   Persisted ChromaDB vector store (gitignored except .gitkeep)
├── .env                         Local env vars (gitignored)
├── .env.example                 Template
├── requirements.txt             Pinned to Python 3.11-compatible versions
├── Dockerfile                   For Render deployment (pre-downloads embedding model)
└── render.yaml                  Render service config
```

---

## Key Design Decisions

### LLM — `app/services/llm.py`
- Model: `moonshotai/kimi-k2.5` via `langchain_nvidia_ai_endpoints.ChatNVIDIA`
- Streaming: `llm.astream(messages)` → async generator of tokens
- System prompt: `MEDICAL_SYSTEM_PROMPT` is baked in — do not change without user approval
- Reasoning tokens (`additional_kwargs["reasoning_content"]`) are deliberately not forwarded to the client

### RAG — `app/rag/`
- `get_embeddings()` and `get_vectorstore()` are both singletons (module-level `_var`)
- The embedding model is pre-warmed in the FastAPI `lifespan` in `main.py`
- `retrieve_context(query, k=4)` returns the top-4 most similar chunks as plain strings
- RAG context is injected into the user message, not the system prompt
- When `use_search=True`, RAG is skipped — the search agent provides its own context

### Auth — `app/core/auth.py`
- The backend has no JWT secret of its own; it delegates to NextAuth by calling `GET {NEXTJS_URL}/api/auth/session` with the token as a cookie value
- Returns `{"id": ..., "email": ..., "name": ...}` on success; raises 401 on failure
- `user["id"]` is the Google OAuth subject (`sub`) — used as `user_id` in all DB tables

### SSE Streaming — `app/api/routes/chat.py`
- Returns a `StreamingResponse` with `media_type="text/event-stream"`
- **Order of operations** (critical — do not change):
  1. Create/validate conversation
  2. Save user message to DB
  3. Load history from DB
  4. Build RAG-enriched message list
  5. Start streaming → yield `meta` event first (so frontend can redirect URL)
  6. Yield `token` events
  7. Save assistant message to DB
  8. Auto-title conversation if first exchange
  9. Yield `done` in `finally` block (always runs, even on error)

### File Upload Security — `app/api/routes/pdf.py`
- `_safe_filename()`: strips path components, removes non-alphanumeric chars
- `_resolve_safe_dest()`: resolves the final path and asserts it's inside `knowledge_base/`
- `_write_limited()`: streams the upload in 64 KB chunks, raises HTTP 413 if > 20 MB
- These three functions must be used for all file writes. Never use `file.filename` directly as a path.

### Anki Generation — `app/agents/anki_agent.py`
- The LLM is instructed to return only a raw JSON array (no markdown fences)
- `_extract_json()` strips fences if present and attempts regex fallback if `json.loads` fails
- `_sanitize_cards()` validates field types, clamps difficulty/type to allowed values, deduplicates by normalised `front` text
- If parsing fails entirely, `generate_anki_cards()` returns `[]` — the route returns a user-friendly error, not a 500

---

## Adding a New Route

1. Create `app/api/routes/your_route.py`
2. Define a `router = APIRouter(prefix="/your-path", tags=["your-tag"])`
3. Use `user = Depends(current_user)` on every endpoint that touches user data
4. For any endpoint that queries by a resource ID, always add a user ownership check before returning data
5. Register in `app/main.py`: `app.include_router(your_route.router, prefix="/api")`

---

## Supabase Queries Pattern

```python
from app.db.supabase import get_db

db = get_db()

# Always scope to user_id
db.table("conversations")
    .select("*")
    .eq("user_id", user["id"])
    .order("created_at", desc=True)
    .execute()

# Ownership check before accessing by ID
row = db.table("conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("user_id", user["id"])
    .maybe_single()
    .execute()
if not row.data:
    raise HTTPException(404, "Not found")
```

Never query by ID alone without also checking `user_id`.

---

## Common Pitfalls

- **Do not upgrade LangChain past 0.2.x** without updating all import paths — 0.3+ moved `langchain.text_splitter` and `langchain_community.embeddings`
- **Do not use `metadata: dict = {}`** — use `Field(default_factory=dict)` (mutable default bug)
- **ChromaDB `_collection` is a private attribute** — accessing it via `vs._collection` is necessary for low-level operations (hash dedup); this is intentional
- **`save_message` is called BEFORE streaming starts** — this is intentional to prevent race conditions where the user navigates away before the stream completes
