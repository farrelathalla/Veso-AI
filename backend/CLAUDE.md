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

Do NOT run with Python 3.13 (the global default on this machine). The pinned packages require 3.11 pre-built wheels. On 3.13, `pymupdf==1.24.5` and `pydantic==2.7.1` fail to install because they need Visual Studio Build Tools and meson breaks on the path apostrophe in `Farrel's Laptop`.

---

## Folder Structure

```
backend/
├── app/
│   ├── main.py                  FastAPI app + CORS + router registration + lifespan
│   ├── core/
│   │   ├── config.py            Pydantic Settings — all env vars loaded here
│   │   └── auth.py              Verifies Google access token via googleapis.com/oauth2/v3/userinfo
│   ├── api/
│   │   ├── deps.py              current_user dependency (extracts Bearer token)
│   │   └── routes/
│   │       ├── health.py        GET /api/health, GET /api/me
│   │       ├── chat.py          GET/DELETE conversations, POST /api/chat/stream (SSE)
│   │       ├── anki.py          POST generate, GET decks/cards, DELETE deck
│   │       ├── pdf.py           POST upload, POST summarize (SSE)
│   │       └── rag.py           POST ingest, GET status
│   ├── agents/
│   │   ├── search_agent.py      DuckDuckGo/Tavily search → stream synthesised answer; Tavily primary when key set
│   │   └── anki_agent.py        Kimi-K2-Instruct → JSON cards → _clean_text → sanitise/dedup
│   ├── rag/
│   │   ├── embeddings.py        Singleton HuggingFace all-MiniLM-L6-v2
│   │   ├── vector_store.py      ChromaDB client + retrieve_context() + retrieve_from_source()
│   │   └── pdf_processor.py     .txt + .pdf → Document chunks; ingest_knowledge_base()
│   ├── services/
│   │   ├── llm.py               get_llm() → ChatNVIDIA; stream_response(); generate_title()
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
- Model: `moonshotai/kimi-k2-instruct` via `langchain_nvidia_ai_endpoints.ChatNVIDIA`
- Use `max_tokens`, not `max_completion_tokens` — the latter is silently ignored by the NVIDIA endpoint
- Streaming: `llm.astream(messages)` → async generator of tokens
- `MEDICAL_SYSTEM_PROMPT` — baked into every chat request. Do not change without user approval.
- Reasoning tokens (`additional_kwargs["reasoning_content"]`) are deliberately not forwarded to the client
- `generate_title(text)` — non-streaming helper for 3–7 word titles; used by `chat.py` (first exchange) and `anki.py` (after deck creation). Falls back to truncated input on failure.
- **LLM output formatting rules** added to `MEDICAL_SYSTEM_PROMPT`: the model is explicitly instructed never to use Anki cloze syntax (`{{c1::...}}`), `§` section markers, or "make Anki cards from §1" workflow suggestions in chat responses. Kimi-K2-Instruct occasionally produces these from training data; the prompt suppresses them at the source.

### RAG — `app/rag/vector_store.py`
- `get_embeddings()` and `get_vectorstore()` are both singletons (module-level `_var`)
- The embedding model is pre-warmed in the FastAPI `lifespan` in `main.py`
- Two retrieval modes:
  - **`retrieve_context(query, k)`** — semantic similarity search across the full collection. Used for general queries with no specific file attached.
  - **`retrieve_from_source(source, k)`** — fetches chunks by `metadata.source == source` using `vs._collection.get(where={"source": source})`. Used when the user has attached a specific file. Bypasses semantic search entirely, guaranteeing all returned chunks are from that exact file.
- **Why two modes?** Queries like "explain this pdf" or "make anki cards based on this pdf" are meta-instructions, not medical content — semantic search on them returns irrelevant chunks. Source-filtered retrieval solves this by anchoring retrieval to the filename rather than the query.
- RAG context is injected into the user message, not the system prompt
- When `use_search=True` in chat, RAG is skipped — the search agent provides its own context
- `_collection` is a private attribute, but accessing it via `vs._collection` is intentional for low-level operations (hash dedup, source filtering)

### Chat History / Context Window — `app/services/chat_service.py`
- `get_conversation_history(conversation_id, limit=12)` returns the last 12 messages with `role`, `content`, and `metadata`
- These are passed to `stream_response()` which only reads `role` and `content` — `metadata` is ignored by the LLM pipeline (safe, does not leak to model)
- The rolling 12-message window means follow-up prompts ("explain more detail") correctly refer back to earlier topics within the same conversation
- `save_message(conv_id, role, content, metadata=None)` — the `metadata` dict is used to store structured non-content data (see below)

### `messages.metadata` Keys
| Key | Role | Value |
|---|---|---|
| `ankiDeck` | `assistant` | `{ id, title, card_count }` — marks message as inline Anki deck card |
| `attachedFile` | `user` | `string` — filename of the PDF/TXT attached when the message was sent |

Both are set at write time and reconstructed by the frontend loader from `m.metadata?.ankiDeck` / `m.metadata?.attachedFile`.

### Auth — `app/core/auth.py`
- Verifies Google access tokens by calling `GET https://www.googleapis.com/oauth2/v3/userinfo` with the token as a `Bearer` header. This replaced the original NextAuth session endpoint approach, which caused persistent 401 errors.
- Returns `{"id": ..., "email": ..., "name": ...}` on success (mapping `sub` → `id`); raises 401 on failure
- `user["id"]` is the Google OAuth subject (`sub`) — used as `user_id` in all DB tables
- `NEXTJS_URL` is no longer used for auth (it is still set in env for reference)

### SSE Streaming — `app/api/routes/chat.py`
Returns a `StreamingResponse` with `media_type="text/event-stream"`.

**Order of operations (critical — do not change):**
1. Create/validate conversation
2. Save user message to DB (with `metadata.attachedFile` if file was attached)
3. Load history from DB (12 messages)
4. RAG retrieval — `retrieve_from_source` if `attached_file` is set, else `retrieve_context`
5. Build message list with context
6. Yield `meta` event (carries `conversation_id`)
7. Stream LLM tokens → yield `token` events
8. Save assistant message to DB
9. Auto-title conversation if first exchange
10. Yield `done` in `finally` block (always runs, even on error)

### Anki Generation — `app/agents/anki_agent.py`
- The LLM is instructed to return only a raw JSON array (no markdown fences)
- `_extract_json()` strips fences if present; regex fallback if `json.loads` fails; truncation recovery salvages complete cards from partial output
- `_clean_text(text)` — strips LLM output artifacts before any card is saved:
  - `{{c1::answer}}` → `answer` (unwrap cloze)
  - `{{c?}}`, other broken `{{...}}` → removed
  - `§1`, `§2`, `§` → removed
  - Leading stray punctuation (`., `) → stripped
  - Multiple spaces → collapsed
- `_sanitize_cards()` calls `_clean_text` on every `front` and `back`, validates field types, clamps difficulty/type to allowed values, deduplicates by normalised `front` text
- If parsing fails entirely, returns `[]` — the route returns a user-friendly error, not 500
- The `ANKI_SYSTEM_PROMPT` string uses `{{` / `}}` around all literal JSON braces — Python's `.format()` would consume single `{` / `}` and raise `KeyError`

### Anki Route — `app/api/routes/anki.py`
Context retrieval priority order:
1. If `attached_file` is set → `retrieve_from_source(attached_file, k=10)`
2. Else → `retrieve_context(topic, k=6)`
3. If `use_search` is True → `_run_search(topic)` appended to context (can combine with 1 or 2)
4. `additional_context` from request → also appended

All four sources are joined and sent to the card generator.

Title generation:
- If `attached_file` is set and chunks were retrieved → `generate_title(chunks[0][:300])` (title from file content, not user's meta-instruction)
- Otherwise → `generate_title(topic)`

Chat persistence (when `conversation_id` is provided):
1. Verify conversation belongs to user (ownership check)
2. `save_message(conv_id, "user", topic, metadata={"attachedFile": attached_file})`
3. `save_message(conv_id, "assistant", "", metadata={"ankiDeck": {...}})`

### File Upload Security — `app/api/routes/pdf.py`
- `_safe_filename()`: strips path components, removes non-alphanumeric chars
- `_resolve_safe_dest()`: resolves the final path and asserts it's inside `knowledge_base/`
- `_write_limited()`: streams the upload in 64 KB chunks, raises HTTP 413 if > 20 MB
- These three functions must be used for all file writes. Never use `file.filename` directly as a path.

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
- **`vs._collection` is intentional** — used for source-filtered retrieval and hash dedup; do not "fix" it to use the public API
- **`save_message` is called BEFORE streaming starts** — intentional; prevents lost messages if user navigates away mid-stream
- **`max_tokens` not `max_completion_tokens`** — NVIDIA ChatNVIDIA silently ignores `max_completion_tokens`
- **`get_conversation_history` returns `metadata`** — this is safe; `stream_response` only reads `role` and `content` from each message dict, extra keys are ignored
- **`_run_search` is synchronous** — it is imported from `search_agent.py` and called directly in the Anki route (not inside an async generator). This is fine for a non-streaming endpoint; the call blocks the request briefly while DuckDuckGo/Tavily responds.
- **DuckDuckGo is a scraper** — it gets blocked/rate-limited on cloud servers and even locally. Always prefer Tavily (set TAVILY_API_KEY). DDG is kept only as a zero-config fallback.
- **Anki title from file** — when `attached_file` is set and chunks are retrieved, title comes from `chunks[0][:300]`, not `topic`. If chunks is empty (file not in ChromaDB), falls back to `topic`. Always check `if req.attached_file and rag_chunks` before using `rag_chunks[0]`.
