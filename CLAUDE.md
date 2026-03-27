# Veso AI — Project CLAUDE.md

> Read this file completely before touching any code. It is the single source of truth for project context, architecture decisions, and conventions.

---

## What This Project Is

**Veso AI** is a medical-student AI chatbot. It lets students ask medical questions (general or detailed), upload study materials, search the web for the latest information, summarise documents, and generate Anki flashcards — all backed by a reasoning LLM (Kimi-K2-Instruct via NVIDIA).

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
| LLM | `langchain_nvidia_ai_endpoints` → `moonshotai/kimi-k2-instruct` |
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
2. NextAuth issues a session — the `accessToken` (Google access token) and `refreshToken` are embedded in the session object via the `jwt` callback in `frontend/auth.ts`
3. The frontend uses `access_type: "offline"` and `prompt: "consent"` in the Google provider config to obtain a refresh token. The JWT callback auto-refreshes the access token before it expires (Google tokens expire in 1 hour; the session window is 30 days).
4. Every API call from the frontend sends `Authorization: Bearer <accessToken>` to the backend
5. The backend (`backend/app/core/auth.py`) verifies the token by calling `https://www.googleapis.com/oauth2/v3/userinfo` with the token as a Bearer header. This replaced the original NextAuth session endpoint approach, which caused 401 errors.
6. If valid, the user's `id` (Google `sub`), `email`, and `name` are returned and used for all DB queries

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

### `messages.metadata` field

The `metadata` JSONB column on `messages` is used to store structured data that does not belong in `content`. Current keys used:

| Key | Present on | Value |
|---|---|---|
| `ankiDeck` | `assistant` messages | `{ id, title, card_count }` — marks the message as an inline Anki deck card |
| `attachedFile` | `user` messages | `string` — filename of an uploaded PDF/TXT that was attached when the message was sent |

When loading messages in the frontend, these keys are mapped to `Message.ankiDeck` and `Message.attachedFile` respectively. **Do not query `messages.metadata` in LLM history context** — `get_conversation_history` returns `metadata` but `stream_response` only reads `role` and `content`, so the extra field is harmless but never forwarded to the model.

---

## Knowledge Base & RAG

- Medical textbook `.txt` files live in `backend/knowledge_base/`
- `.pdf` files are also supported (via PyMuPDF) but `.txt` is preferred
- Files are chunked at 600 tokens / 60 token overlap by `RecursiveCharacterTextSplitter`
- Chunks are embedded with `all-MiniLM-L6-v2` and stored in ChromaDB at `backend/chroma_db/`
- Each chunk has metadata: `{ source: filename, hash: md5, type: "pdf"|"txt" }`
- Ingest is **idempotent** — files already indexed (matched by MD5 hash) are skipped
- To trigger ingest: `POST /api/rag/ingest` (requires auth)
- To check status: `GET /api/rag/status` — returns chunk count + list of indexed files
- RAG is injected into chat as context before the user message in the LLM prompt

### Two RAG retrieval modes

There are two retrieval functions in `backend/app/rag/vector_store.py`:

1. **`retrieve_context(query, k=5)`** — semantic similarity search across the entire ChromaDB collection. Used for general chat queries (no file attached).

2. **`retrieve_from_source(source, k=20)`** — fetches chunks filtered by `metadata.source == source` using ChromaDB's `where` filter directly on `_collection.get()`. Used when the user has attached a specific file. This bypasses semantic search entirely, guaranteeing all retrieved chunks are from that exact file regardless of the query wording.

> **Why two modes?** Semantic search on meta-instructions like "explain this pdf" or "make anki cards based on this pdf" does not match medical content chunks well. Source-filtered retrieval solves this — the filename is used as the anchor, not the user's query text.

---

## File Upload & Attached File Flow

### Upload

`POST /api/pdf/upload` ingests the file into ChromaDB and returns `{ filename, chunks_ingested }`. The frontend stores `filename` in `ChatInput` state and shows a badge in the input area.

### Sending with an attached file

When the user submits a message (chat or Anki mode) while a file badge is shown, `attachedFile` (the sanitised filename) is passed through the entire request chain:

```
ChatInput
  → onSend(text, { useRag, useSearch, attachedFile })      # chat mode
  → generateAnki({ topic, max_cards, conversation_id, attached_file })  # Anki mode
      ↓
frontend/lib/api.ts  streamChat / generateAnki
      ↓
POST /api/chat/stream      { ..., attached_file: "filename.pdf" }
POST /api/anki/generate    { ..., attached_file: "filename.pdf" }
      ↓
backend: retrieve_from_source("filename.pdf", k=6|10)
```

### Filename shown in chat history

The filename is stored in the user message's DB metadata (`metadata.attachedFile`) and reconstructed into `Message.attachedFile` when messages are loaded. `MessageBubble` renders a small `FileText` badge above the user's text bubble when this field is present, so the chat history always shows which file was attached.

### Anki title when file is attached

When `attached_file` is provided to `POST /api/anki/generate`, the deck title is generated from the first 300 characters of the retrieved file content (`generate_title(rag_chunks[0][:300])`), not from the user's typed instruction (which is often "make anki cards based on this pdf" — useless as a title). The user's topic text is still sent to the LLM as part of the card generation prompt for additional guidance.

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
- The generate endpoint auto-retrieves RAG context for the topic before calling the LLM
- `save_deck_and_cards` accepts a separate `title` parameter (LLM-generated, 3–7 words) distinct from `topic`
- The `ANKI_SYSTEM_PROMPT` uses `{{` / `}}` to escape literal braces in the JSON example — Python's `.format()` would otherwise treat single `{` / `}` as placeholders
- `_extract_json` includes recovery logic to salvage complete cards from truncated LLM output

### Anki card text sanitisation

`_sanitize_cards` in `anki_agent.py` calls `_clean_text()` on every `front` and `back` field before saving. This strips artifacts that the LLM sometimes produces even when instructed not to:

| Pattern | Transform |
|---|---|
| `{{c1::topoisomerase}}` | → `topoisomerase` (unwrap cloze answer) |
| `{{c?}}`, `{{c2::}}` broken/empty | → removed entirely |
| `§1`, `§2`, `§` | → removed |
| Leading stray `., ` punctuation | → stripped |
| Multiple spaces introduced by removals | → collapsed |

---

## Anki from Chat — Persistence

When Anki mode is used inside an existing conversation (`/chat/[id]`), both the user's topic message and the assistant Anki deck card are saved to the conversation so they survive page reload.

### How it works

`POST /api/anki/generate` accepts an optional `conversation_id`. When provided:

1. The route verifies the conversation belongs to the requesting user (ownership check — never skip this).
2. Saves a `user` message: `content = topic, metadata = {}`.
3. Saves an `assistant` message: `content = "", metadata = { ankiDeck: { id, title, card_count } }`.

On the frontend, `ChatInput` passes the current URL `id` param as `conversation_id` when calling `generateAnki`. The `[id]/page.tsx` loader reconstructs `message.ankiDeck` from `metadata.ankiDeck` when fetching messages, so the inline deck card renders correctly after reload.

### Why the assistant message has empty content

The Anki deck card is a special UI element (`MessageBubble` checks for `message.ankiDeck` before falling through to the markdown renderer). The actual deck data lives in `metadata.ankiDeck`, not `content`. Storing an empty string in `content` keeps the schema consistent (all messages have a `content` field) while the metadata carries the structured payload.

> This pattern does NOT apply to the new-chat page (`/chat`). If Anki is generated before any regular message exists (no conversation ID in the URL), there is no conversation to attach to. The deck is still created and the inline card is shown in local state; it just is not persisted to chat history. This is intentional — the user will navigate to the Anki page or start a real conversation.

---

## LLM-Generated Titles

Both chat conversations and Anki decks receive auto-generated titles (3–7 words) via `generate_title()` in `backend/app/services/llm.py`. The function calls the LLM with a short prompt; if it fails it falls back to a truncated version of the user's input. Titles are set after the first user/assistant exchange (chat) or after deck creation (Anki).

**Special case — Anki with attached file:** the title is generated from `rag_chunks[0][:300]` (first content chunk from the file), not from `req.topic`. This prevents titles like "Create Anki Cards From PDF" when the user's instruction was a meta-command rather than a real topic name.

---

## Chat & UI Behaviour

- **Anki from chat** — when Anki is generated while in "Anki mode" inside chat, a clickable deck card is rendered inline in the conversation instead of redirecting to `/anki`. The deck is persisted to the conversation's message history (see "Anki from Chat — Persistence" above).
- **File upload flow** — `POST /api/pdf/upload` ingests the file into RAG and returns a confirmation. The frontend shows a file badge in the input area; the user types their own follow-up prompt. When sent, the filename is passed to the backend as `attached_file` which triggers source-filtered RAG retrieval. There is no auto-summarize on upload.
- **Filename in chat bubble** — when a user message was sent with an attached file, a `FileText` badge showing the filename appears above the message bubble. This persists across reloads via `messages.metadata.attachedFile`.
- **Markdown rendering** — `MessageBubble` renders AI responses as markdown (bold, headers, lists, fenced code blocks, inline code) using inline `renderMarkdown` / `inlineMarkdown` helper functions. There is no `react-markdown` dependency. Before rendering, `cleanChatText()` strips Anki cloze syntax and `§` markers from the raw content.
- **Responsive sidebar** — on mobile, `ChatListPanel` slides in as an overlay when the hamburger (Menu icon) in `IconRail` is tapped. A new client component `frontend/components/DashboardShell.tsx` owns the `sidebarOpen` state and replaces the direct composition that was in `(dashboard)/layout.tsx`.
- **SSE navigation timing** — `router.replace("/chat/<id>")` is now called on the `done` event, not on the `meta` event. This prevents the chat component from unmounting while the stream is still active.

---

## LLM Output Formatting Rules (Chat)

The `MEDICAL_SYSTEM_PROMPT` in `backend/app/services/llm.py` explicitly forbids the following in chat responses:

- Anki cloze deletion syntax — `{{c1::...}}`, `{{c2::...}}`, `{{c?}}`
- Section markers — `§1`, `§2`, bare `§`
- Anki workflow suggestion lines — "make Anki cards from §1", "batch-generate", "Need cards? Ask..."

**Why:** Kimi-K2-Instruct, having been trained on Anki-related content, sometimes generates these patterns unprompted in medical explanations. They are meaningless in a chat context and confuse users.

**Defense in depth:** Even when the LLM follows the prompt, `cleanChatText()` in `MessageBubble.tsx` applies the same cleanup client-side as a safety net for any existing messages already stored in the DB:

```typescript
// {{c1::answer}} → answer
text = text.replace(/\{\{c\d+::([^}]*)\}\}/g, "$1")
// broken {{...}} → removed
text = text.replace(/\{\{[^}]*\}\}/g, "")
// §1 §2 § → removed
text = text.replace(/§\s*\d*/g, "")
// "Need cards? Ask..." lines → line removed
// "make Anki cards from..." lines → line removed
// "batch-generate" lines → line removed
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| GET | `/api/me` | Yes | Current user info |
| GET | `/api/chat/conversations` | Yes | List user's conversations |
| GET | `/api/chat/conversations/{id}/messages` | Yes | Get messages with metadata (ownership verified) |
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

### `POST /api/chat/stream` request body
```json
{
  "message": "string",
  "conversation_id": "uuid | null",
  "use_rag": true,
  "use_search": false,
  "attached_file": "filename.pdf | null"
}
```

### `POST /api/anki/generate` request body
```json
{
  "topic": "string",
  "additional_context": "string | null",
  "max_cards": 20,
  "conversation_id": "uuid | null",
  "attached_file": "filename.pdf | null"
}
```

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
5. **Anki-from-chat conversation ownership** — `POST /api/anki/generate` verifies `conversation_id` belongs to the requesting user before saving messages into it.
6. **CORS regex** — anchored: `^https://[a-zA-Z0-9\-]+\.vercel\.app$` to prevent ReDoS.
7. **SSE error termination** — the `event_generator` wraps streaming in `try/except/finally` so `done` is always emitted even on LLM failure.
8. **Mutable default args** — `metadata` fields use `Field(default_factory=dict)`, not `= {}`.
9. **Anki JSON parse failure** — `generate_anki_cards()` returns `[]` on parse error; the route returns a user-friendly error message instead of 500.

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
| NVIDIA Kimi-K2-Instruct | Existing NVIDIA NIM key |
| Google OAuth | Free |

---

## Things That Must Never Change Without Explicit User Approval

- Anki card rules (count, types, difficulty, clinical phrasing)
- Brand color `#10A37F` used only for AI identity and primary actions
- No emoji in UI copy, labels, placeholders, or tooltips
- Python 3.11 venv for local development
- The SSE event format (`meta` → `token`* → `done`)
- File upload is restricted to `.pdf` and `.txt` only
- `cleanChatText()` must always run before `renderMarkdown()` in `MessageBubble` — never render raw LLM output directly
