# Veso AI — Project CLAUDE.md

> Read this file completely before touching any code. It is the single source of truth for project context, architecture decisions, and conventions.

---

## What This Project Is

**Veso AI** is a medical-student AI chatbot. It lets students ask medical questions (general or detailed), upload study materials, search the web for the latest information, summarise documents, and generate Anki flashcards — all backed by a reasoning LLM (Kimi-K2.5 via NVIDIA).

Target users: medical students studying for board exams (USMLE, PLAB, etc.).

---

## Monorepo Structure

```
Veso-AI/
├── frontend/          Next.js 16 app  → deploys to Vercel
├── backend/           FastAPI app     → deploys to Render (Docker)
├── docs/
│   ├── UI_DESIGN_SPEC.md     complete visual design specification (ALWAYS read before touching UI)
│   └── plans/
│       └── 2026-03-27-veso-ai-full-build.md   original implementation plan
└── CLAUDE.md          (this file)
```

The two apps are **deployed separately** — frontend on Vercel, backend on Render — but live in one repo. Never merge their concerns.

---

## Tech Stack

### Frontend
| Thing | Value |
|---|---|
| Framework | Next.js **16.2.1** (App Router) |
| Language | TypeScript |
| Auth | NextAuth.js **v5 beta** (`next-auth@^5.0.0-beta.30`) |
| Styling | Tailwind CSS **v4** — CSS-first config via `@theme` in `globals.css`, NOT `tailwind.config.ts` |
| Animation | Framer Motion v12 |
| Icons | Lucide React |
| Streaming | Native `fetch` + `ReadableStream` (SSE), not `EventSource` |

### Backend
| Thing | Value |
|---|---|
| Framework | FastAPI 0.111 |
| Language | Python **3.11** (pinned — see venv section) |
| LLM | `langchain_nvidia_ai_endpoints` → `moonshotai/kimi-k2.5` |
| Vector DB | ChromaDB (persistent, local at `backend/chroma_db/`) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` — runs on CPU, completely free |
| Search | DuckDuckGo (`duckduckgo-search`) — no API key needed |
| Database | Supabase (free tier) — Postgres for users, chats, Anki cards |
| File parsing | PyMuPDF (PDF), plain `read_text` (TXT) |

---

## Running Locally

### Backend (MUST use Python 3.11 venv — not global Python 3.13)

```bash
cd backend

# Create venv with Python 3.11 (one-time)
"C:\Users\Farrel's Laptop\AppData\Local\Programs\Python\Python311\python.exe" -m venv .venv

# Activate (every session)
.venv\Scripts\activate          # Windows PowerShell/CMD
# source .venv/bin/activate     # Mac/Linux

# Install deps (one-time, or after requirements.txt changes)
pip install -r requirements.txt

# Copy env and fill in values (one-time)
cp .env.example .env

# Run
python -m uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/api/health  should return {"status":"ok"}
```

> **Why Python 3.11?** The pinned dependency versions (`langchain==0.2.5`, `pydantic==2.7.1`, `chromadb==0.5.0`, `pymupdf==1.24.5`) all have pre-built wheels for Python 3.11. On Python 3.13 they try to compile from source and fail because they need Visual Studio Build Tools and meson breaks on the apostrophe in the Windows username path (`Farrel's Laptop`).

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in values
npm install
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

### `backend/.env`
```
NVIDIA_API_KEY=nvapi-...           # NVIDIA NIM API key for Kimi-K2.5
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...        # service_role key (not anon key)
NEXTJS_URL=http://localhost:3000   # change to Vercel URL in production
NEXTAUTH_SECRET=...                # generate: openssl rand -base64 32
ENVIRONMENT=development            # set to "production" on Render
```

### `frontend/.env.local`
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...                # same value as backend
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:8000   # change to Render URL in production
```

---

## Authentication Flow

1. User signs in via Google OAuth on `/login` (NextAuth v5)
2. NextAuth issues a session — the `accessToken` (Google access token) is embedded in the session object via the `jwt` callback in `frontend/auth.ts`
3. Every API call from the frontend sends `Authorization: Bearer <accessToken>` to the backend
4. The backend (`backend/app/core/auth.py`) verifies the token by calling the NextAuth session endpoint at `{NEXTJS_URL}/api/auth/session` with the token in a cookie
5. If valid, the user's `id`, `email`, and `name` are returned and used for all DB queries

> All backend routes that touch user data use `Depends(current_user)` from `backend/app/api/deps.py`. Do not skip this.

---

## Database Schema (Supabase)

```sql
conversations  (id, user_id, title, created_at, updated_at)
messages       (id, conversation_id, role, content, metadata, created_at)
anki_decks     (id, user_id, title, topic, card_count, created_at)
anki_cards     (id, deck_id, user_id, front, back, difficulty, card_type, position)
```

- `user_id` is always the Google sub (subject) from the JWT — a string like `"108xxx"`
- RLS is enabled on all tables; the backend uses the **service_role** key which bypasses RLS — user scoping is enforced in application code (every query includes `.eq("user_id", user["id"])`)
- `difficulty` ∈ `{easy, medium, hard}`, `card_type` ∈ `{concept, conceptual, clinical}`

---

## Knowledge Base & RAG

- Medical textbook `.txt` files live in `backend/knowledge_base/`
- `.pdf` files are also supported (via PyMuPDF) but `.txt` is preferred
- Files are chunked at 600 tokens / 60 token overlap by `RecursiveCharacterTextSplitter`
- Chunks are embedded with `all-MiniLM-L6-v2` and stored in ChromaDB at `backend/chroma_db/`
- Ingest is **idempotent** — files already indexed (matched by MD5 hash) are skipped
- To trigger ingest: `POST /api/rag/ingest` (requires auth)
- To check status: `GET /api/rag/status` — returns chunk count + list of indexed files
- RAG is injected into chat as context before the user message in the LLM prompt

---

## Anki Card Rules (DO NOT CHANGE without user approval)

These are product requirements, not technical choices:

- 15–25 cards per deck
- Three card types evenly mixed: `concept`, `conceptual`, `clinical`
- Three difficulty levels: `easy`, `medium`, `hard`
- No repeated concepts (deduplicated by normalised front text)
- Prioritise high-yield, exam-relevant content
- Simple, clear English
- Clinical info must use cautious phrasing: "may indicate", "is often associated with", "consult a healthcare professional"
- No definitive diagnoses or treatment instructions
- No hallucinated image details
- Output is strict JSON array — parsed and sanitised in `backend/app/agents/anki_agent.py`

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| GET | `/api/me` | Yes | Current user info |
| GET | `/api/chat/conversations` | Yes | List user's conversations |
| GET | `/api/chat/conversations/{id}/messages` | Yes | Get messages (ownership verified) |
| DELETE | `/api/chat/conversations/{id}` | Yes | Delete conversation |
| POST | `/api/chat/stream` | Yes | SSE streaming chat |
| POST | `/api/anki/generate` | Yes | Generate Anki deck |
| GET | `/api/anki/decks` | Yes | List user's decks |
| GET | `/api/anki/decks/{id}/cards` | Yes | Get cards (ownership verified) |
| DELETE | `/api/anki/decks/{id}` | Yes | Delete deck |
| POST | `/api/pdf/upload` | Yes | Upload file → ingest to ChromaDB |
| POST | `/api/pdf/summarize` | Yes | Upload file → SSE summary |
| POST | `/api/rag/ingest` | Yes | Ingest knowledge_base/ files |
| GET | `/api/rag/status` | Yes | ChromaDB index status |

### SSE Event Format (`/api/chat/stream` and `/api/pdf/summarize`)
```
data: {"type": "meta", "conversation_id": "uuid"}   ← sent first, before any tokens
data: {"type": "token", "content": "Hello"}          ← one per chunk
data: {"type": "error", "message": "..."}            ← on failure
data: {"type": "done", "conversation_id": "uuid"}    ← always last
```

---

## Security Decisions Already Made

These were found in a security review and fixed. Do not regress them:

1. **Path traversal** — `backend/app/api/routes/pdf.py` sanitises filenames with `_safe_filename()` and `_resolve_safe_dest()`. Never use raw `file.filename` as a path.
2. **File size limit** — enforced via `_write_limited()` in `pdf.py` (20 MB max). The constant `_MAX_UPLOAD_BYTES` is enforced, not just defined.
3. **Conversation ownership** — `GET /conversations/{id}/messages` verifies `user_id` before returning data. Always do this for any new user-scoped route.
4. **Deck ownership** — `GET /anki/decks/{id}/cards` verifies `user_id` before returning data.
5. **CORS regex** — anchored: `^https://[a-zA-Z0-9\-]+\.vercel\.app$` to prevent ReDoS.
6. **SSE error termination** — the `event_generator` wraps streaming in `try/except/finally` so `done` is always emitted even on LLM failure.
7. **Mutable default args** — `metadata` fields use `Field(default_factory=dict)`, not `= {}`.
8. **Anki JSON parse failure** — `generate_anki_cards()` returns `[]` on parse error; the route returns a user-friendly error message instead of 500.

---

## UI Design System

The full spec is in `docs/UI_DESIGN_SPEC.md`. **Always read it before writing any UI.**

Key tokens (defined in `frontend/app/globals.css` under `@theme`):
```
brand-primary   #10A37F    AI identity, primary actions, active states only
surface-0       #1E1F22    deepest background
surface-1       #282A2E    panel backgrounds
surface-2       #3F424A    message bubbles, cards
surface-3       #4B4F5B    input fields
surface-4       #858B9D    placeholder, muted meta text
neutral         #F4F4F4    primary text
accent-warning  #FEC553    warning badges only
accent-error    #F27474    destructive/error states only
```

Tailwind v4 uses CSS custom properties — reference colors as `bg-brand-primary`, `text-surface-4`, etc.

---

## Deployment

### Backend → Render (free tier)
- Root directory: `backend/`
- Runtime: Docker (uses `backend/Dockerfile`)
- The Dockerfile pre-downloads the HuggingFace embedding model at build time
- Free tier sleeps after 15 min of inactivity; first request after sleep takes ~30s
- After deploy: call `POST /api/rag/ingest` once to index the knowledge base on the server

### Frontend → Vercel (free)
- Root directory: `frontend/`
- No special build config needed — standard Next.js

### Post-deploy checklist
1. Set `NEXTJS_URL` in Render env vars to the Vercel URL
2. Set `NEXT_PUBLIC_API_URL` in Vercel env vars to the Render URL
3. Add Vercel URL to Google OAuth authorised origins and redirect URIs
4. Trigger RAG ingest via `POST /api/rag/ingest`

---

## What Is Free

| Service | Why free |
|---|---|
| Vercel | Hobby plan |
| Render | Free tier (sleeps) |
| Supabase | Free tier (500 MB DB) |
| ChromaDB | Local on Render disk |
| HuggingFace embeddings | `all-MiniLM-L6-v2` runs on CPU, no API |
| DuckDuckGo search | No API key required |
| NVIDIA Kimi-K2.5 | Existing NVIDIA NIM key |
| Google OAuth | Free |

---

## Things That Must Never Change Without Explicit User Approval

- Anki card rules (count, types, difficulty, clinical phrasing)
- Brand color `#10A37F` used only for AI identity and primary actions
- No emoji in UI copy, labels, placeholders, or tooltips
- Python 3.11 venv for local development
- The SSE event format (`meta` → `token`* → `done`)
- File upload is restricted to `.pdf` and `.txt` only
