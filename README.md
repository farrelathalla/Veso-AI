# Veso AI

A medical-student AI chatbot for board exam preparation. Ask medical questions, upload study materials, search the web for latest guidelines, and generate Anki flashcards — all in one place.

Built for USMLE / PLAB students.

---

## Features

- **Conversational AI** — ask anything medical; the LLM has rolling context over the last 12 messages in each conversation, so follow-up prompts ("explain more detail") always resolve correctly
- **File upload** — attach a PDF or TXT to any chat message or Anki generation; the system retrieves content specifically from that file rather than running a generic semantic search
- **Web search** — toggle DuckDuckGo search to ground answers and cards in the latest guidelines and evidence
- **RAG** — uploaded files and knowledge-base documents are chunked, embedded, and stored in ChromaDB; retrieved as context on every relevant request
- **Anki flashcard generation** — 15–25 cards per deck, three types (concept / conceptual / clinical), three difficulty levels; generated from topic + any combination of uploaded file, knowledge base, web search, and manual notes
- **Anki from chat** — generate a deck inline inside any conversation; the deck card appears immediately and persists across reloads
- **Filename badge** — when a file is attached to a message, the filename is shown in the chat bubble and preserved in history
- **Markdown rendering** — AI responses render bold, headings, lists, tables, and code blocks without any third-party markdown library

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.1 (App Router), TypeScript, Tailwind CSS v4, Framer Motion, NextAuth v5 beta |
| Backend | FastAPI 0.111, Python 3.11 |
| LLM | `moonshotai/kimi-k2-instruct` via NVIDIA NIM (`langchain_nvidia_ai_endpoints`) |
| Vector DB | ChromaDB (persistent, local) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` — CPU, no API key |
| Search | DuckDuckGo (`duckduckgo-search`) — no API key |
| Database | Supabase (Postgres) |
| Auth | Google OAuth via NextAuth v5 |

Everything is on free tiers.

---

## Project Structure

```
Veso-AI/
├── frontend/          Next.js 16 app  → Vercel
├── backend/           FastAPI app     → Render (Docker)
├── docs/
│   ├── UI_DESIGN_SPEC.md
│   └── plans/
└── CLAUDE.md          Full architecture reference (read before touching code)
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11 (specifically — see backend note below)
- A Supabase project
- A Google OAuth app (Client ID + Secret)
- An NVIDIA NIM API key

### Backend

```bash
cd backend

# Python 3.11 venv is required — not global Python
"C:\Users\...\Python311\python.exe" -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

pip install -r requirements.txt

cp .env.example .env
# fill in .env (see below)

python -m uvicorn app.main:app --reload
# → http://localhost:8000
```

**`backend/.env`**
```
NVIDIA_API_KEY=nvapi-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEXTJS_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
ENVIRONMENT=development
```

> **Why Python 3.11?** `langchain==0.2.5`, `pydantic==2.7.1`, `chromadb==0.5.0`, and `pymupdf==1.24.5` all have pre-built wheels for 3.11. On 3.13 they try to compile from source and fail.

### Frontend

```bash
cd frontend

cp .env.local.example .env.local
# fill in .env.local (see below)

npm install
npm run dev
# → http://localhost:3000
```

**`frontend/.env.local`**
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same value as backend>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Database (Supabase)

Run these in the Supabase SQL editor:

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table anki_decks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  topic text,
  card_count int not null default 0,
  created_at timestamptz default now()
);

create table anki_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references anki_decks(id) on delete cascade,
  user_id text not null,
  front text not null,
  back text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  card_type text not null check (card_type in ('concept', 'conceptual', 'clinical')),
  position int not null default 0
);

-- Enable RLS (backend uses service_role key which bypasses it)
alter table conversations enable row level security;
alter table messages enable row level security;
alter table anki_decks enable row level security;
alter table anki_cards enable row level security;
```

### Seed the Knowledge Base (optional)

Drop `.txt` or `.pdf` medical textbooks into `backend/knowledge_base/`, then:

```bash
curl -X POST http://localhost:8000/api/rag/ingest \
  -H "Authorization: Bearer <your-google-access-token>"
```

---

## API Reference

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
| GET | `/api/rag/status` | Yes | ChromaDB chunk count + file list |

### Chat stream request body
```json
{
  "message": "string",
  "conversation_id": "uuid | null",
  "use_rag": true,
  "use_search": false,
  "attached_file": "filename.pdf | null"
}
```

### Anki generate request body
```json
{
  "topic": "string",
  "additional_context": "string | null",
  "max_cards": 20,
  "conversation_id": "uuid | null",
  "attached_file": "filename.pdf | null",
  "use_search": false
}
```

### SSE event format
```
data: {"type": "meta", "conversation_id": "uuid"}
data: {"type": "token", "content": "..."}
data: {"type": "error", "message": "..."}
data: {"type": "done", "conversation_id": "uuid"}
```

---

## Deployment

### Backend → Render

- Root directory: `backend/`
- Runtime: Docker
- The `Dockerfile` pre-downloads the HuggingFace embedding model at build time so the first request doesn't time out
- Free tier sleeps after 15 min of inactivity; first request after wake takes ~30 s

### Frontend → Vercel

- Root directory: `frontend/`
- Standard Next.js — no special config needed

### Post-deploy checklist

1. Set `NEXTJS_URL` in Render env vars → Vercel URL
2. Set `NEXT_PUBLIC_API_URL` in Vercel env vars → Render URL
3. Add Vercel URL to Google OAuth authorised origins and redirect URIs
4. Trigger RAG ingest: `POST /api/rag/ingest`

---

## Known Issues & Fixes Applied

### Anki messages disappearing on reload

**Problem:** When Anki was generated from chat mode, neither the user's prompt nor the deck card were saved to the database — they only existed in React state. On reload both vanished.

**Fix:** `POST /api/anki/generate` now accepts a `conversation_id`. When provided, it saves a `user` message (topic + `metadata.attachedFile`) and an `assistant` message (`content: ""`, `metadata.ankiDeck: { id, title, card_count }`) to the conversation. The frontend loader reconstructs `ankiDeck` and `attachedFile` from metadata when fetching messages. Additionally, `handleAnkiCreated` now immediately adds both bubbles to local React state so they appear without waiting for a reload.

### PDF context not picked up

**Problem:** Queries like "explain this pdf" or "make anki cards based on this pdf" were used as ChromaDB semantic search queries — they don't match medical content. The LLM received no relevant context even though the file was ingested.

**Fix:** Added `retrieve_from_source(filename, k)` which fetches chunks by `metadata.source == filename` using ChromaDB's `where` filter, bypassing semantic search entirely. When `attached_file` is present in a request, this function is used instead of `retrieve_context`.

### Anki title was the user's instruction

**Problem:** When using Anki mode with "make anki cards based on this pdf", the deck title became exactly that string. `generate_title` was called with the meta-instruction rather than the file content.

**Fix:** When `attached_file` is set and chunks were retrieved, title is generated from the first 300 characters of the file content: `generate_title(rag_chunks[0][:300])`.

### User prompt bubble missing filename badge after reload

**Problem:** The user message saved by the Anki route had empty metadata — `attached_file` was in the request but never written to `metadata.attachedFile` on the saved message.

**Fix:** Anki route now passes `metadata={"attachedFile": req.attached_file}` to `save_message` when `attached_file` is present, matching the pattern used by the chat route.

### Cloze syntax and § markers in chat responses

**Problem:** Kimi-K2-Instruct occasionally generates Anki cloze syntax (`{{c1::topoisomerase}}`, `{{c?}}`) and section markers (`§1`, `§2`) in regular chat responses, having seen this format in training data.

**Fix (two layers):**
1. `MEDICAL_SYSTEM_PROMPT` explicitly forbids these patterns at the source
2. `cleanChatText()` in `MessageBubble.tsx` strips them client-side as a safety net for existing messages and LLM prompt misses: `{{cN::answer}}` → `answer`, `{{c?}}` → removed, `§N` → removed, "Need cards? Ask..." lines → line removed

### Anki card text contained cloze syntax

**Problem:** LLM sometimes generated Anki cloze format in the `front`/`back` fields of generated cards, making them display raw syntax like `{{c1::valin}}`.

**Fix:** `_clean_text()` in `anki_agent.py` is called on every `front` and `back` field before the card is saved, applying the same pattern stripping.

---

## Architecture Decisions

**Why source-filtered retrieval instead of hybrid search?**
A meta-instruction query ("explain this pdf") has near-zero cosine similarity to the medical content it refers to. Semantic search fails silently — it returns results but from unrelated documents. Source filtering is deterministic: if the file was ingested, its chunks are returned.

**Why `messages.metadata` for ankiDeck and attachedFile?**
The `content` field should only hold what the user/assistant actually said. Structured UI data (deck references, file names) is orthogonal to conversational content and belongs in metadata. This keeps the LLM history clean — `stream_response()` only reads `role` and `content`, so metadata never leaks into the model context.

**Why capture topic/attachedFile before clearing state in ChatInput?**
JavaScript closures over React state capture the value at render time. After `await generateAnki(...)` resolves, `setText("")` has run. If the callback uses `text` or `attachedFile` from state instead of local captures, it gets empty strings. Always capture as local variables before any state mutation inside an async function.

**Why 12-message context window?**
Balances conversation coherence against token cost. 12 messages ≈ 6 exchanges, enough for a focused study session on one topic. Older messages are dropped; if a user needs older context they should start a new conversation.

---

## Contributing

Read `CLAUDE.md` completely before making any changes — it is the single source of truth for architecture decisions, security constraints, and conventions that must not be regressed.
