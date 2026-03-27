# Veso AI — Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Build Veso AI — a medical-student chatbot with streaming LLM responses, vector RAG from PDFs, a Google Search agent, PDF upload/summarization, and Anki card generation with flip-card UI, backed by Google OAuth and persistent chat history.

**Architecture:** Monorepo with a Next.js frontend (Vercel) and a FastAPI backend (Render), communicating over HTTP/SSE. Auth is Google OAuth via NextAuth.js; a JWT from the session is forwarded to the backend for identity verification. All storage uses Supabase free tier (Postgres) for user data and ChromaDB (local persistent) for vectors.

**Tech Stack:**
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, NextAuth.js, Framer Motion, SSE via native `EventSource`
- **Backend**: FastAPI, Python 3.11, LangChain, `langchain_nvidia_ai_endpoints` (Kimi-K2.5), ChromaDB, HuggingFace sentence-transformers (local, free), DuckDuckGo search (free), PyMuPDF, Supabase-py
- **Knowledge Base**: `.txt` files supported (primary); `.pdf` also accepted
- **Database**: Supabase (free tier) — Postgres for users / conversations / messages / anki decks / anki cards
- **Deployment**: Vercel (frontend, free), Render (backend, free tier)

---

## Repo Structure

```
Veso-AI/
├── frontend/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── chat/page.tsx
│   │   │   ├── chat/[id]/page.tsx
│   │   │   └── anki/page.tsx
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── chat/
│   │   ├── anki/
│   │   ├── sidebar/
│   │   └── ui/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── types.ts
│   ├── .env.local.example
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── chat.py        # SSE streaming chat
│   │   │   ├── anki.py        # Anki card CRUD
│   │   │   ├── pdf.py         # Upload + summarize
│   │   │   ├── rag.py         # RAG ingest
│   │   │   └── health.py
│   │   ├── agents/
│   │   │   ├── medical_agent.py   # Main LangChain agent
│   │   │   ├── search_agent.py    # DuckDuckGo tool
│   │   │   └── anki_agent.py      # Anki card generator
│   │   ├── rag/
│   │   │   ├── vector_store.py    # ChromaDB wrapper
│   │   │   ├── embeddings.py      # HF sentence-transformers
│   │   │   └── pdf_processor.py   # PyMuPDF chunker
│   │   ├── services/
│   │   │   ├── llm.py             # NVIDIA Kimi-K2.5 client
│   │   │   ├── chat_service.py    # History + context assembly
│   │   │   └── anki_service.py    # Card formatting + DB save
│   │   ├── db/
│   │   │   ├── supabase.py        # Supabase client
│   │   │   └── models.py          # Pydantic schemas
│   │   ├── core/
│   │   │   ├── config.py          # Settings (env vars)
│   │   │   └── auth.py            # JWT verification
│   │   └── main.py
│   ├── knowledge_base/    # Drop PDFs here for RAG
│   ├── chroma_db/         # Persisted vector DB
│   ├── .env.example
│   ├── requirements.txt
│   └── render.yaml
├── docs/
│   ├── plans/
│   └── UI_DESIGN_SPEC.md
├── .gitignore
└── README.md
```

---

## Environment Variables

### `backend/.env.example`
```
NVIDIA_API_KEY=nvapi-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEXTJS_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
ENVIRONMENT=development
```

### `frontend/.env.local.example`
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Supabase Schema (run in Supabase SQL editor)

```sql
-- conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- anki_decks
create table if not exists anki_decks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  topic text,
  card_count int default 0,
  created_at timestamptz default now()
);

-- anki_cards
create table if not exists anki_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references anki_decks(id) on delete cascade,
  user_id text not null,
  front text not null,
  back text not null,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')) not null,
  card_type text check (card_type in ('concept', 'conceptual', 'clinical')) not null,
  position int default 0,
  created_at timestamptz default now()
);

-- RLS: enable on all tables
alter table conversations enable row level security;
alter table messages enable row level security;
alter table anki_decks enable row level security;
alter table anki_cards enable row level security;

-- Service role bypasses RLS — backend uses service key
```

---

## Session 1: Scaffold + Config + Auth

**Exit criteria:** Repo initialized, both apps boot, Google login works end-to-end, `/api/health` returns 200.

---

### Task 1: Repo scaffold + .gitignore

**Files:**
- Create: `.gitignore`
- Create: `README.md`

**Steps:**

**Step 1: Create root .gitignore**

```
# Python
backend/__pycache__/
backend/.venv/
backend/.env
backend/chroma_db/*
!backend/chroma_db/.gitkeep
backend/knowledge_base/*.pdf

# Node
frontend/node_modules/
frontend/.next/
frontend/.env.local

# General
.DS_Store
*.pyc
*.pyo
Thumbs.db
```

**Step 2: Create README.md at root**

```markdown
# Veso AI

Medical student AI chatbot — RAG, agents, Anki cards.

## Structure
- `frontend/` — Next.js app → deploy to Vercel
- `backend/` — FastAPI app → deploy to Render
- `backend/knowledge_base/` — drop your PDFs here for RAG

## Quick Start
See `frontend/README.md` and `backend/README.md`.
```

**Step 3: Commit**
```bash
git add .gitignore README.md
git commit -m "chore: repo scaffold and gitignore"
```

---

### Task 2: Backend scaffold (FastAPI)

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/api/routes/health.py`

**Step 1: Write requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-dotenv==1.0.1
pydantic==2.7.1
pydantic-settings==2.2.1

# LangChain + NVIDIA
langchain==0.2.5
langchain-community==0.2.5
langchain-core==0.2.7
langchain_nvidia_ai_endpoints==0.1.2

# RAG
chromadb==0.5.0
sentence-transformers==3.0.1
pymupdf==1.24.5

# Search
duckduckgo-search==6.1.9

# Database
supabase==2.4.3

# Auth
python-jose[cryptography]==3.3.0
httpx==0.27.0

# Streaming
sse-starlette==2.1.0

# File upload
python-multipart==0.0.9
```

**Step 2: Write config.py**

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    nvidia_api_key: str
    supabase_url: str
    supabase_service_key: str
    nextjs_url: str = "http://localhost:3000"
    nextauth_secret: str
    environment: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 3: Write health route**

```python
# backend/app/api/routes/health.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "service": "veso-ai-backend"}
```

**Step 4: Write main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health
from app.core.config import settings

app = FastAPI(title="Veso AI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.nextjs_url, "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

**Step 5: Create .env from example, boot server**
```bash
cd backend
cp .env.example .env   # fill in values
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
# Expected: INFO: Uvicorn running on http://127.0.0.1:8000
```

**Step 6: Test health endpoint**
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok","service":"veso-ai-backend"}
```

**Step 7: Commit**
```bash
git add backend/
git commit -m "feat: fastapi backend scaffold with health endpoint"
```

---

### Task 3: Frontend scaffold (Next.js)

**Files:**
- Create: `frontend/` — bootstrapped Next.js app

**Step 1: Bootstrap**
```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

**Step 2: Install dependencies**
```bash
npm install next-auth@5.0.0-beta.19 \
  framer-motion \
  lucide-react \
  clsx \
  tailwind-merge \
  @supabase/supabase-js
```

**Step 3: Create .env.local.example**

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 4: Copy to .env.local and fill values**

**Step 5: Boot frontend**
```bash
npm run dev
# Expected: ready on http://localhost:3000
```

**Step 6: Commit**
```bash
git add frontend/
git commit -m "feat: next.js frontend scaffold"
```

---

### Task 4: Google OAuth (NextAuth.js v5)

**Files:**
- Create: `frontend/auth.ts`
- Create: `frontend/app/api/auth/[...nextauth]/route.ts`
- Create: `frontend/app/(auth)/login/page.tsx`
- Modify: `frontend/app/layout.tsx`

**Step 1: Write auth.ts**

```typescript
// frontend/auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.sub!
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
```

**Step 2: Write route handler**

```typescript
// frontend/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

**Step 3: Write login page**

```typescript
// frontend/app/(auth)/login/page.tsx
"use client"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1E1F22]">
      <div className="flex flex-col items-center gap-6 p-10 bg-[#282A2E] rounded-2xl border border-[#3F424A] w-full max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-[#10A37F] flex items-center justify-center">
          <span className="text-white font-bold text-xl">V</span>
        </div>
        <div className="text-center">
          <h1 className="text-[#F4F4F4] text-xl font-semibold">Welcome to Veso AI</h1>
          <p className="text-[#858B9D] text-sm mt-1">Your medical learning companion</p>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/chat" })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#3F424A] hover:bg-[#4B4F5B] text-[#F4F4F4] rounded-xl text-sm font-medium transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Wrap layout with SessionProvider**

```typescript
// frontend/app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Veso AI",
  description: "Medical student AI assistant",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#1E1F22]`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

**Step 5: Test login flow**
- Visit http://localhost:3000/login
- Click "Continue with Google"
- Should redirect to /chat after login

**Step 6: Commit**
```bash
git add frontend/
git commit -m "feat: google oauth with nextauth v5"
```

---

### Task 5: Backend JWT verification

**Files:**
- Create: `backend/app/core/auth.py`
- Create: `backend/app/api/deps.py`

**Step 1: Write auth.py (verify NextAuth session token)**

```python
# backend/app/core/auth.py
import httpx
from fastapi import HTTPException, status
from app.core.config import settings

async def get_current_user(token: str) -> dict:
    """Verify session token by calling NextAuth session endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.nextjs_url}/api/auth/session",
            headers={"Cookie": f"next-auth.session-token={token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    data = resp.json()
    if not data or "user" not in data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return {"id": data["user"]["id"], "email": data["user"]["email"], "name": data["user"]["name"]}
```

**Step 2: Write deps.py**

```python
# backend/app/api/deps.py
from fastapi import Cookie, Depends, HTTPException, Header
from typing import Optional
from app.core.auth import get_current_user

async def current_user(
    authorization: Optional[str] = Header(None),
):
    """Extract user from Authorization: Bearer <session_token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.removeprefix("Bearer ")
    return await get_current_user(token)

# Type alias for route injection
CurrentUser = Depends(current_user)
```

**Step 3: Add a protected test route to health.py**

```python
# backend/app/api/routes/health.py — add:
from fastapi import Depends
from app.api.deps import current_user

@router.get("/me")
async def me(user=Depends(current_user)):
    return user
```

**Step 4: Commit**
```bash
git add backend/
git commit -m "feat: backend jwt/session verification"
```

---

## Session 2: Backend — LLM, RAG, Chat

**Exit criteria:** `/api/chat/stream` returns a streaming SSE response using Kimi-K2.5, RAG retrieves from ChromaDB, chat history saved to Supabase.

---

### Task 6: Supabase client + DB models

**Files:**
- Create: `backend/app/db/supabase.py`
- Create: `backend/app/db/models.py`

**Step 1: supabase.py**

```python
# backend/app/db/supabase.py
from supabase import create_client, Client
from app.core.config import settings

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
```

**Step 2: models.py (Pydantic schemas)**

```python
# backend/app/db/models.py
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    metadata: dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AnkiCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deck_id: str
    user_id: str
    front: str
    back: str
    difficulty: Literal["easy", "medium", "hard"]
    card_type: Literal["concept", "conceptual", "clinical"]
    position: int = 0

class AnkiDeck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    topic: Optional[str] = None
    card_count: int = 0

# Request/Response schemas
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    use_rag: bool = True
    use_search: bool = False

class AnkiGenerateRequest(BaseModel):
    topic: str
    conversation_id: Optional[str] = None
    additional_context: Optional[str] = None
    max_cards: int = Field(default=20, ge=15, le=25)

class PDFSummarizeRequest(BaseModel):
    filename: str  # already uploaded to knowledge_base/
```

**Step 3: Commit**
```bash
git add backend/app/db/
git commit -m "feat: supabase client and pydantic models"
```

---

### Task 7: LLM service (NVIDIA Kimi-K2.5)

**Files:**
- Create: `backend/app/services/llm.py`

**Step 1: llm.py**

```python
# backend/app/services/llm.py
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from app.core.config import settings
from typing import AsyncGenerator

MEDICAL_SYSTEM_PROMPT = """You are Veso AI, an expert medical education assistant specialized in helping medical students learn and retain information.

You assist with:
- General and detailed medical questions (anatomy, physiology, pathology, pharmacology, clinical medicine)
- Explaining complex concepts clearly and concisely
- Summarizing medical documents and research papers
- Generating study materials and Anki cards

Guidelines:
- Use precise medical terminology but explain it when needed
- Structure responses clearly with headings when helpful
- For clinical information, always phrase cautiously: use "may indicate", "is often associated with", "consult a healthcare professional"
- Never give definitive diagnoses or definitive treatment instructions
- Cite context from retrieved documents when available
- Focus on exam-relevant, high-yield information
- Use simple, clear English — avoid unnecessary complexity"""

def get_llm() -> ChatNVIDIA:
    return ChatNVIDIA(
        model="moonshotai/kimi-k2.5",
        api_key=settings.nvidia_api_key,
        temperature=1,
        top_p=1,
        max_completion_tokens=16384,
    )

async def stream_response(
    messages: list,
    system_prompt: str = MEDICAL_SYSTEM_PROMPT,
) -> AsyncGenerator[str, None]:
    """Stream tokens from Kimi-K2.5 as an async generator."""
    llm = get_llm()
    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        else:
            lc_messages.append(AIMessage(content=msg["content"]))

    async for chunk in llm.astream(lc_messages):
        content = chunk.content
        if content:
            yield content
        # Emit reasoning tokens as metadata if present
        if chunk.additional_kwargs.get("reasoning_content"):
            pass  # reasoning not sent to client, used internally
```

**Step 2: Commit**
```bash
git add backend/app/services/llm.py
git commit -m "feat: nvidia kimi-k2.5 llm service with streaming"
```

---

### Task 8: Embeddings + ChromaDB vector store

**Files:**
- Create: `backend/app/rag/embeddings.py`
- Create: `backend/app/rag/vector_store.py`
- Create: `backend/app/rag/pdf_processor.py`

**Step 1: embeddings.py**

```python
# backend/app/rag/embeddings.py
from langchain_community.embeddings import HuggingFaceEmbeddings

_embeddings = None

def get_embeddings() -> HuggingFaceEmbeddings:
    """Returns a singleton HuggingFace embedding model (all-MiniLM-L6-v2).
    Downloads once, runs locally, completely free."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings
```

**Step 2: vector_store.py**

```python
# backend/app/rag/vector_store.py
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_community.vectorstores import Chroma
from app.rag.embeddings import get_embeddings
from pathlib import Path

CHROMA_PATH = Path(__file__).parent.parent.parent / "chroma_db"
COLLECTION_NAME = "medical_knowledge"

_vectorstore = None

def get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        client = chromadb.PersistentClient(
            path=str(CHROMA_PATH),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _vectorstore = Chroma(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding_function=get_embeddings(),
        )
    return _vectorstore

def retrieve_context(query: str, k: int = 5) -> list[str]:
    """Retrieve top-k relevant chunks for a query."""
    vs = get_vectorstore()
    docs = vs.similarity_search(query, k=k)
    return [doc.page_content for doc in docs]

def add_documents(docs: list) -> None:
    """Add LangChain Document objects to ChromaDB."""
    vs = get_vectorstore()
    vs.add_documents(docs)
```

**Step 3: pdf_processor.py**

```python
# backend/app/rag/pdf_processor.py
import fitz  # PyMuPDF
import hashlib
from pathlib import Path
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent.parent / "knowledge_base"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

def _pdf_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

def load_pdf_chunks(pdf_path: Path) -> list[Document]:
    """Extract text from PDF and split into overlapping chunks."""
    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text() for page in doc)
    doc.close()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.create_documents(
        [full_text],
        metadatas=[{"source": pdf_path.name, "hash": _pdf_hash(pdf_path)}],
    )
    return chunks

def ingest_knowledge_base(vectorstore, already_indexed: set[str]) -> dict:
    """Ingest all PDFs in knowledge_base/ that haven't been indexed yet."""
    results = {"ingested": [], "skipped": []}
    for pdf_path in KNOWLEDGE_BASE_PATH.glob("*.pdf"):
        file_hash = _pdf_hash(pdf_path)
        if file_hash in already_indexed:
            results["skipped"].append(pdf_path.name)
            continue
        chunks = load_pdf_chunks(pdf_path)
        vectorstore.add_documents(chunks)
        results["ingested"].append(pdf_path.name)
    return results

def summarize_pdf_text(pdf_path: Path) -> str:
    """Extract full text for summarization."""
    doc = fitz.open(str(pdf_path))
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text[:12000]  # cap at 12k chars for LLM context
```

**Step 4: Commit**
```bash
git add backend/app/rag/
git commit -m "feat: chromadb vector store, huggingface embeddings, pdf processor"
```

---

### Task 9: Chat service + history

**Files:**
- Create: `backend/app/services/chat_service.py`

**Step 1: chat_service.py**

```python
# backend/app/services/chat_service.py
from app.db.supabase import get_db
from app.db.models import Conversation, Message
from app.rag.vector_store import retrieve_context
from typing import Optional
import uuid

def get_or_create_conversation(user_id: str, conversation_id: Optional[str], title: str = "New Chat") -> str:
    db = get_db()
    if conversation_id:
        return conversation_id
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id, title=title)
    db.table("conversations").insert(conv.model_dump()).execute()
    return conv.id

def get_conversation_history(conversation_id: str, limit: int = 10) -> list[dict]:
    db = get_db()
    result = (
        db.table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return result.data or []

def save_message(conversation_id: str, role: str, content: str, metadata: dict = {}) -> None:
    db = get_db()
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        metadata=metadata,
    )
    db.table("messages").insert(msg.model_dump()).execute()

def get_user_conversations(user_id: str) -> list[dict]:
    db = get_db()
    result = (
        db.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data or []

def update_conversation_title(conversation_id: str, title: str) -> None:
    db = get_db()
    db.table("conversations").update({"title": title}).eq("id", conversation_id).execute()

def build_messages_with_context(
    history: list[dict],
    user_message: str,
    rag_context: list[str] | None,
) -> list[dict]:
    """Assemble message list, injecting RAG context into the user turn."""
    messages = list(history)
    content = user_message
    if rag_context:
        context_block = "\n\n---\n".join(rag_context)
        content = (
            f"Relevant context from medical knowledge base:\n\n{context_block}"
            f"\n\n---\n\nQuestion: {user_message}"
        )
    messages.append({"role": "user", "content": content})
    return messages
```

**Step 2: Commit**
```bash
git add backend/app/services/chat_service.py
git commit -m "feat: chat service with supabase history and rag context injection"
```

---

### Task 10: Chat streaming API route

**Files:**
- Create: `backend/app/api/routes/chat.py`
- Modify: `backend/app/main.py`

**Step 1: chat.py**

```python
# backend/app/api/routes/chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.api.deps import current_user
from app.db.models import ChatRequest
from app.services.chat_service import (
    get_or_create_conversation,
    get_conversation_history,
    save_message,
    get_user_conversations,
    update_conversation_title,
    build_messages_with_context,
)
from app.rag.vector_store import retrieve_context
from app.services.llm import stream_response
import json

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    from app.services.chat_service import get_user_conversations
    return get_user_conversations(user["id"])

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user=Depends(current_user)):
    return get_conversation_history(conversation_id, limit=100)

@router.post("/stream")
async def chat_stream(req: ChatRequest, user=Depends(current_user)):
    """SSE streaming endpoint. Client reads via EventSource."""
    # 1. Get/create conversation
    conv_id = get_or_create_conversation(user["id"], req.conversation_id)

    # 2. Load history
    history = get_conversation_history(conv_id, limit=10)

    # 3. RAG retrieval
    rag_context = None
    if req.use_rag:
        rag_context = retrieve_context(req.message, k=4)

    # 4. Build message list
    messages = build_messages_with_context(history, req.message, rag_context)

    # 5. Save user message
    save_message(conv_id, "user", req.message)

    # 6. Stream response
    full_response = []

    async def event_generator():
        # Send conversation_id first so client can track it
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conv_id})}\n\n"
        async for token in stream_response(messages):
            full_response.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        # Save complete response to DB
        complete = "".join(full_response)
        save_message(conv_id, "assistant", complete)
        # Auto-title the conversation from first user message
        if len(history) == 0:
            title = req.message[:60] + ("..." if len(req.message) > 60 else "")
            update_conversation_title(conv_id, title)
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Step 2: Register router in main.py**

```python
# backend/app/main.py — add to imports and registrations:
from app.api.routes import health, chat

app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
```

**Step 3: Commit**
```bash
git add backend/app/api/routes/chat.py backend/app/main.py
git commit -m "feat: sse streaming chat endpoint with rag and history"
```

---

## Session 3: Backend — Agents + Anki + PDF

**Exit criteria:** Search agent works, Anki card generation returns valid JSON, PDF upload + summarize works.

---

### Task 11: DuckDuckGo search agent

**Files:**
- Create: `backend/app/agents/search_agent.py`

**Step 1: search_agent.py**

```python
# backend/app/agents/search_agent.py
from duckduckgo_search import DDGS
from langchain_core.tools import tool
from app.services.llm import stream_response
from typing import AsyncGenerator

@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo. Use for recent medical news, drug approvals, guidelines."""
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=5))
    if not results:
        return "No results found."
    formatted = []
    for i, r in enumerate(results, 1):
        formatted.append(f"{i}. **{r['title']}**\n{r['href']}\n{r['body']}")
    return "\n\n".join(formatted)

async def search_and_answer(
    query: str,
    history: list[dict],
) -> AsyncGenerator[str, None]:
    """Run a search, inject results as context, then stream a synthesized answer."""
    search_results = web_search.invoke({"query": query})
    messages = list(history)
    content = (
        f"Search results for: {query}\n\n{search_results}"
        f"\n\n---\n\nBased on the above search results, answer: {query}"
    )
    messages.append({"role": "user", "content": content})
    async for token in stream_response(messages):
        yield token
```

**Step 2: Wire search into chat route**

In `chat.py`, add an `if req.use_search:` branch that replaces the stream_response call with `search_and_answer`.

```python
# backend/app/api/routes/chat.py — modify event_generator:
from app.agents.search_agent import search_and_answer

# Inside event_generator, replace stream call:
if req.use_search:
    stream = search_and_answer(req.message, history)
else:
    stream = stream_response(messages)

async for token in stream:
    full_response.append(token)
    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
```

**Step 3: Commit**
```bash
git add backend/app/agents/search_agent.py backend/app/api/routes/chat.py
git commit -m "feat: duckduckgo search agent wired into chat stream"
```

---

### Task 12: Anki card generator agent

**Files:**
- Create: `backend/app/agents/anki_agent.py`
- Create: `backend/app/services/anki_service.py`
- Create: `backend/app/api/routes/anki.py`

**Step 1: anki_agent.py — the prompt + JSON extraction**

```python
# backend/app/agents/anki_agent.py
from app.services.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage
import json
import re

ANKI_SYSTEM_PROMPT = """You are a medical education specialist creating high-quality Anki flashcards for medical students.

Card requirements:
- Generate between 15 and 25 cards total
- Mix card types evenly: "concept" (direct fact/definition), "conceptual" (mechanism/understanding), "clinical" (applied/case-based)
- Tag each card difficulty: "easy", "medium", or "hard"
- Prioritize high-yield, exam-relevant concepts
- Use simple, clear English — avoid unnecessary jargon
- No repetition — each card tests a distinct point
- Front: one focused question or prompt
- Back: concise, accurate answer (1-5 sentences or a short list)
- For clinical information on the back, use cautious phrasing: "may indicate", "is often associated with", "consult a healthcare professional"
- Never hallucinate facts — only use information provided in the context
- Do NOT give definitive diagnoses or treatment instructions

Output ONLY a valid JSON array. No markdown fences. No explanation. Example structure:
[
  {
    "front": "What is the main function of the loop of Henle?",
    "back": "Concentration of urine via countercurrent multiplication. The descending limb is permeable to water; the ascending limb is impermeable to water but actively transports NaCl.",
    "difficulty": "medium",
    "card_type": "concept"
  }
]"""

async def generate_anki_cards(
    topic: str,
    context: str = "",
    max_cards: int = 20,
) -> list[dict]:
    """Call Kimi-K2.5 to generate Anki cards as structured JSON."""
    llm = get_llm()
    user_content = f"Topic: {topic}\n\nMax cards: {max_cards}"
    if context:
        user_content += f"\n\nAdditional context:\n{context[:8000]}"

    messages = [
        SystemMessage(content=ANKI_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = await llm.ainvoke(messages)
    raw = response.content.strip()

    # Strip markdown code fences if model adds them
    raw = re.sub(r"^```(?:json)?\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        cards = json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract JSON array from response
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            cards = json.loads(match.group())
        else:
            raise ValueError("Model did not return valid JSON for Anki cards")

    # Validate and sanitize
    valid_types = {"concept", "conceptual", "clinical"}
    valid_diffs = {"easy", "medium", "hard"}
    sanitized = []
    for card in cards[:max_cards]:
        if not isinstance(card, dict):
            continue
        if not card.get("front") or not card.get("back"):
            continue
        sanitized.append({
            "front": str(card.get("front", "")),
            "back": str(card.get("back", "")),
            "difficulty": card.get("difficulty", "medium") if card.get("difficulty") in valid_diffs else "medium",
            "card_type": card.get("card_type", "concept") if card.get("card_type") in valid_types else "concept",
        })
    return sanitized
```

**Step 2: anki_service.py**

```python
# backend/app/services/anki_service.py
from app.db.supabase import get_db
from app.db.models import AnkiDeck, AnkiCard
import uuid

def save_deck_and_cards(user_id: str, topic: str, cards: list[dict]) -> dict:
    db = get_db()
    deck = AnkiDeck(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=f"{topic[:60]} — Anki Deck",
        topic=topic,
        card_count=len(cards),
    )
    db.table("anki_decks").insert(deck.model_dump()).execute()

    card_rows = []
    for i, c in enumerate(cards):
        card = AnkiCard(
            id=str(uuid.uuid4()),
            deck_id=deck.id,
            user_id=user_id,
            front=c["front"],
            back=c["back"],
            difficulty=c["difficulty"],
            card_type=c["card_type"],
            position=i,
        )
        card_rows.append(card.model_dump())

    db.table("anki_cards").insert(card_rows).execute()
    return {"deck_id": deck.id, "card_count": len(card_rows)}

def get_user_decks(user_id: str) -> list[dict]:
    db = get_db()
    return db.table("anki_decks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data or []

def get_deck_cards(deck_id: str, user_id: str) -> list[dict]:
    db = get_db()
    return (
        db.table("anki_cards")
        .select("*")
        .eq("deck_id", deck_id)
        .eq("user_id", user_id)
        .order("position")
        .execute()
        .data or []
    )

def delete_deck(deck_id: str, user_id: str) -> None:
    db = get_db()
    db.table("anki_decks").delete().eq("id", deck_id).eq("user_id", user_id).execute()
```

**Step 3: anki.py route**

```python
# backend/app/api/routes/anki.py
from fastapi import APIRouter, Depends, UploadFile, File
from app.api.deps import current_user
from app.db.models import AnkiGenerateRequest
from app.agents.anki_agent import generate_anki_cards
from app.services.anki_service import save_deck_and_cards, get_user_decks, get_deck_cards, delete_deck
from app.rag.pdf_processor import KNOWLEDGE_BASE_PATH
import shutil

router = APIRouter(prefix="/anki", tags=["anki"])

@router.post("/generate")
async def generate(req: AnkiGenerateRequest, user=Depends(current_user)):
    cards = await generate_anki_cards(
        topic=req.topic,
        context=req.additional_context or "",
        max_cards=req.max_cards,
    )
    result = save_deck_and_cards(user["id"], req.topic, cards)
    return {**result, "cards": cards}

@router.get("/decks")
async def list_decks(user=Depends(current_user)):
    return get_user_decks(user["id"])

@router.get("/decks/{deck_id}/cards")
async def list_cards(deck_id: str, user=Depends(current_user)):
    return get_deck_cards(deck_id, user["id"])

@router.delete("/decks/{deck_id}")
async def delete(deck_id: str, user=Depends(current_user)):
    delete_deck(deck_id, user["id"])
    return {"status": "deleted"}
```

**Step 4: Register routers in main.py**

```python
from app.api.routes import health, chat, anki, pdf, rag
app.include_router(anki.router, prefix="/api")
```

**Step 5: Commit**
```bash
git add backend/app/agents/anki_agent.py backend/app/services/anki_service.py backend/app/api/routes/anki.py
git commit -m "feat: anki card generation agent with supabase persistence"
```

---

### Task 13: PDF upload + summarization + RAG ingest

**Files:**
- Create: `backend/app/api/routes/pdf.py`
- Create: `backend/app/api/routes/rag.py`

**Step 1: pdf.py**

```python
# backend/app/api/routes/pdf.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.api.deps import current_user
from app.rag.pdf_processor import load_pdf_chunks, summarize_pdf_text, KNOWLEDGE_BASE_PATH
from app.rag.vector_store import get_vectorstore
from app.services.llm import stream_response
from fastapi.responses import StreamingResponse
import json
import shutil

router = APIRouter(prefix="/pdf", tags=["pdf"])

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload a PDF to knowledge_base/ and ingest into ChromaDB."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")
    dest = KNOWLEDGE_BASE_PATH / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    chunks = load_pdf_chunks(dest)
    get_vectorstore().add_documents(chunks)
    return {"filename": file.filename, "chunks_ingested": len(chunks)}

@router.post("/summarize")
async def summarize_pdf(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload a PDF and stream a summary."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")
    dest = KNOWLEDGE_BASE_PATH / f"_tmp_{file.filename}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    text = summarize_pdf_text(dest)
    dest.unlink()  # remove temp file

    messages = [
        {
            "role": "user",
            "content": (
                f"Summarize this medical document for a medical student. "
                f"Highlight key concepts, mechanisms, and clinical pearls.\n\n{text}"
            ),
        }
    ]

    async def event_gen():
        async for token in stream_response(messages):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
```

**Step 2: rag.py (manual ingest trigger)**

```python
# backend/app/api/routes/rag.py
from fastapi import APIRouter, Depends
from app.api.deps import current_user
from app.rag.pdf_processor import ingest_knowledge_base
from app.rag.vector_store import get_vectorstore

router = APIRouter(prefix="/rag", tags=["rag"])

@router.post("/ingest")
async def ingest(user=Depends(current_user)):
    """Ingest all PDFs from knowledge_base/ into ChromaDB."""
    vs = get_vectorstore()
    # Get existing source hashes to skip already-indexed files
    collection = vs._collection
    existing = collection.get(include=["metadatas"])
    already_indexed = {m.get("hash", "") for m in existing.get("metadatas", [])}
    result = ingest_knowledge_base(vs, already_indexed)
    return result
```

**Step 3: Register remaining routers in main.py**

```python
from app.api.routes import health, chat, anki, pdf, rag
app.include_router(pdf.router, prefix="/api")
app.include_router(rag.router, prefix="/api")
```

**Step 4: Commit**
```bash
git add backend/app/api/routes/pdf.py backend/app/api/routes/rag.py backend/app/main.py
git commit -m "feat: pdf upload, summarization and rag ingest endpoints"
```

---

## Session 4: Frontend — Core UI + Chat

**Exit criteria:** App shell renders per UI_DESIGN_SPEC.md, chat page streams responses, sidebar shows conversation history.

---

### Task 14: Design tokens + Tailwind config

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/globals.css`

**Step 1: tailwind.config.ts — add Veso color tokens**

```typescript
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#10A37F",
          tint: "#D8EFE9",
          dark: "#1E1F22",
        },
        surface: {
          0: "#1E1F22",
          1: "#282A2E",
          2: "#3F424A",
          3: "#4B4F5B",
          4: "#858B9D",
          5: "#ABABAB",
        },
        accent: {
          warning: "#FEC553",
          error: "#F27474",
        },
        neutral: "#F4F4F4",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
export default config
```

**Step 2: globals.css — base styles**

```css
/* frontend/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  html { font-family: 'Inter', system-ui, sans-serif; }
  body { background: #1E1F22; color: #F4F4F4; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #4B4F5B; border-radius: 9999px; }
  ::-webkit-scrollbar-thumb:hover { background: #858B9D; }
  ::selection { background: #10A37F33; }
  *:focus-visible { outline: 2px solid #10A37F; outline-offset: 2px; }
}
```

**Step 3: Commit**
```bash
git add frontend/tailwind.config.ts frontend/app/globals.css
git commit -m "feat: veso design tokens in tailwind config"
```

---

### Task 15: Shared types + API client

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`

**Step 1: types.ts**

```typescript
// frontend/lib/types.ts
export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  created_at?: string
}

export interface AnkiCard {
  id: string
  front: string
  back: string
  difficulty: "easy" | "medium" | "hard"
  card_type: "concept" | "conceptual" | "clinical"
  position: number
}

export interface AnkiDeck {
  id: string
  title: string
  topic: string
  card_count: number
  created_at: string
}
```

**Step 2: api.ts — typed fetch wrapper**

```typescript
// frontend/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

async function authHeaders(session: any): Promise<HeadersInit> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.accessToken ?? ""}`,
  }
}

export async function getConversations(session: any) {
  const res = await fetch(`${BASE}/api/chat/conversations`, {
    headers: await authHeaders(session),
  })
  return res.json()
}

export async function getMessages(conversationId: string, session: any) {
  const res = await fetch(`${BASE}/api/chat/conversations/${conversationId}/messages`, {
    headers: await authHeaders(session),
  })
  return res.json()
}

export function streamChat(
  payload: { message: string; conversation_id?: string; use_rag?: boolean; use_search?: boolean },
  session: any,
  onToken: (token: string) => void,
  onMeta: (meta: { conversation_id: string }) => void,
  onDone: () => void,
): () => void {
  const ctrl = new AbortController()
  ;(async () => {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.accessToken ?? ""}`,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const json = JSON.parse(line.slice(6))
        if (json.type === "meta") onMeta(json)
        if (json.type === "token") onToken(json.content)
        if (json.type === "done") onDone()
      }
    }
  })()
  return () => ctrl.abort()
}

export async function generateAnki(
  payload: { topic: string; additional_context?: string; max_cards?: number },
  session: any,
) {
  const res = await fetch(`${BASE}/api/anki/generate`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getAnkiDecks(session: any) {
  const res = await fetch(`${BASE}/api/anki/decks`, {
    headers: await authHeaders(session),
  })
  return res.json()
}

export async function getDeckCards(deckId: string, session: any) {
  const res = await fetch(`${BASE}/api/anki/decks/${deckId}/cards`, {
    headers: await authHeaders(session),
  })
  return res.json()
}

export async function uploadAndSummarizePDF(
  file: File,
  session: any,
  onToken: (t: string) => void,
  onDone: () => void,
) {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE}/api/pdf/summarize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` },
    body: form,
  })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const json = JSON.parse(line.slice(6))
      if (json.type === "token") onToken(json.content)
      if (json.type === "done") onDone()
    }
  }
}
```

**Step 3: Commit**
```bash
git add frontend/lib/
git commit -m "feat: shared types and api client with sse streaming"
```

---

### Task 16: App shell layout (3-column)

**Files:**
- Create: `frontend/components/sidebar/IconRail.tsx`
- Create: `frontend/components/sidebar/ChatListPanel.tsx`
- Create: `frontend/app/(dashboard)/layout.tsx`

**Step 1: IconRail.tsx**

```tsx
// frontend/components/sidebar/IconRail.tsx
"use client"
import { MessageSquare, Sparkles, BookOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"

const navItems = [
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/anki", icon: BookOpen, label: "Anki Cards" },
]

export function IconRail() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="w-14 flex-shrink-0 bg-surface-0 flex flex-col items-center py-3 gap-2">
      {/* Logo */}
      <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center mb-3">
        <span className="text-white font-bold text-base">V</span>
      </div>

      {/* Nav */}
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`relative w-10 h-10 flex items-center justify-center rounded-md transition-colors
              ${active ? "text-brand-primary" : "text-surface-4 hover:text-neutral hover:bg-white/5"}`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-primary rounded-full -ml-1" />
            )}
            <Icon size={20} strokeWidth={1.5} />
          </Link>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      {session?.user?.image && (
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-brand-primary transition-colors"
        >
          <img src={session.user.image} alt="avatar" className="w-full h-full object-cover" />
        </button>
      )}
    </div>
  )
}
```

**Step 2: ChatListPanel.tsx (sidebar with conversation list)**

```tsx
// frontend/components/sidebar/ChatListPanel.tsx
"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { getConversations } from "@/lib/api"
import type { Conversation } from "@/lib/types"

export function ChatListPanel() {
  const { data: session } = useSession()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [search, setSearch] = useState("")
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (session) getConversations(session).then(setConvs)
  }, [session])

  const filtered = convs.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-64 flex-shrink-0 bg-surface-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] flex-shrink-0">
        <span className="text-neutral font-semibold text-base">My Chats</span>
        <button
          onClick={() => router.push("/chat")}
          className="w-7 h-7 flex items-center justify-center bg-surface-2 rounded-md hover:bg-surface-3 transition-colors"
        >
          <Plus size={16} className="text-neutral" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 bg-surface-2 rounded-full px-3 h-9">
          <Search size={14} className="text-surface-4 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-sm text-neutral placeholder:text-surface-4 outline-none w-full"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.map(conv => {
          const active = pathname === `/chat/${conv.id}`
          return (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className={`flex flex-col px-3 py-3 rounded-lg mb-1 transition-colors
                ${active ? "bg-surface-2" : "hover:bg-white/[0.03]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral truncate">{conv.title}</span>
                <span className="text-[11px] text-surface-4 flex-shrink-0 ml-2">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Dashboard layout**

```tsx
// frontend/app/(dashboard)/layout.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { IconRail } from "@/components/sidebar/IconRail"
import { ChatListPanel } from "@/components/sidebar/ChatListPanel"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      <IconRail />
      <ChatListPanel />
      <main className="flex-1 min-w-0 flex flex-col bg-surface-1">
        {children}
      </main>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add frontend/components/sidebar/ frontend/app/(dashboard)/layout.tsx
git commit -m "feat: 3-column app shell with icon rail and chat list panel"
```

---

### Task 17: Chat page with streaming messages

**Files:**
- Create: `frontend/components/chat/MessageBubble.tsx`
- Create: `frontend/components/chat/ChatInput.tsx`
- Create: `frontend/components/chat/ChatHeader.tsx`
- Create: `frontend/app/(dashboard)/chat/page.tsx`
- Create: `frontend/app/(dashboard)/chat/[id]/page.tsx`

**Step 1: MessageBubble.tsx**

```tsx
// frontend/components/chat/MessageBubble.tsx
"use client"
import { Copy } from "lucide-react"
import { useState } from "react"
import type { Message } from "@/lib/types"

const DIFFICULTY_COLOR = {
  easy: "text-brand-primary",
  medium: "text-accent-warning",
  hard: "text-accent-error",
}

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 group">
        <div className="max-w-[65%]">
          <div className="bg-surface-2 rounded-xl rounded-br-sm px-4 py-3 text-sm text-neutral leading-relaxed">
            {message.content}
          </div>
          <div className="text-[11px] text-surface-4 text-right mt-1">You</div>
        </div>
        <div className="w-7 h-7 rounded-full bg-surface-3 flex-shrink-0 flex items-center justify-center text-xs text-neutral font-medium">
          U
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 group">
      <div className="w-7 h-7 rounded-full bg-brand-primary flex-shrink-0 flex items-center justify-center text-xs text-white font-bold mt-1">
        V
      </div>
      <div className="max-w-[75%] flex flex-col gap-2">
        <div className="bg-surface-2 rounded-xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral">Response</span>
            {!isStreaming && (
              <span className="text-[11px] text-surface-4">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="text-sm text-neutral leading-relaxed whitespace-pre-wrap">
            {message.content}
            {isStreaming && <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse ml-0.5 align-middle" />}
          </div>
        </div>
        {!isStreaming && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded-md text-[12px] text-surface-4 hover:text-neutral transition-colors"
            >
              <Copy size={12} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: ChatInput.tsx**

```tsx
// frontend/components/chat/ChatInput.tsx
"use client"
import { useState, useRef, KeyboardEvent } from "react"
import { Send, Mic, Search, Upload } from "lucide-react"

interface Props {
  onSend: (message: string, options: { useRag: boolean; useSearch: boolean }) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("")
  const [useSearch, setUseSearch] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim(), { useRag: true, useSearch })
    setText("")
    setUseSearch(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }

  return (
    <div className="px-5 py-4 border-t border-surface-2">
      {useSearch && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-tint/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary">
            <Search size={10} />
            Web search enabled
          </div>
          <button onClick={() => setUseSearch(false)} className="text-[11px] text-surface-4 hover:text-accent-error">remove</button>
        </div>
      )}
      <div className="flex items-end gap-3 bg-surface-2 rounded-xl px-4 py-3 border border-transparent focus-within:border-brand-primary transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); autoResize() }}
          onKeyDown={onKey}
          disabled={disabled}
          placeholder="Ask questions, or type / for commands"
          rows={1}
          className="flex-1 bg-transparent text-sm text-neutral placeholder:text-surface-4 outline-none resize-none leading-relaxed"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setUseSearch(s => !s)}
            title="Enable web search"
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors
              ${useSearch ? "bg-brand-primary text-white" : "text-surface-4 hover:text-neutral hover:bg-surface-3"}`}
          >
            <Search size={15} strokeWidth={1.5} />
          </button>
          <button
            onClick={submit}
            disabled={!text.trim() || disabled}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors
              ${text.trim() && !disabled ? "bg-brand-primary hover:bg-brand-primary/90 text-white" : "bg-surface-3 text-surface-4 cursor-not-allowed"}`}
          >
            <Send size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Chat pages (new chat + existing chat)**

```tsx
// frontend/app/(dashboard)/chat/page.tsx
"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { ChatInput } from "@/components/chat/ChatInput"
import { streamChat } from "@/lib/api"
import type { Message } from "@/lib/types"

export default function NewChatPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)

  const handleSend = (text: string, opts: { useRag: boolean; useSearch: boolean }) => {
    if (!session) return
    const userMsg: Message = { role: "user", content: text }
    const aiMsg: Message = { role: "assistant", content: "" }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setStreaming(true)

    streamChat(
      { message: text, use_rag: opts.useRag, use_search: opts.useSearch },
      session,
      (token) => setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + token }
        return updated
      }),
      (meta) => router.replace(`/chat/${meta.conversation_id}`),
      () => setStreaming(false),
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-5 h-[52px] border-b border-surface-2 flex-shrink-0">
        <h1 className="text-neutral font-semibold">New Chat</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
              <span className="text-brand-primary font-bold text-xl">V</span>
            </div>
            <h2 className="text-neutral font-semibold text-lg mb-2">What can I help you learn?</h2>
            <p className="text-surface-4 text-sm max-w-sm">Ask a medical question, upload a PDF to summarize, or request Anki cards on any topic.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
      </div>
      <ChatInput onSend={handleSend} disabled={streaming} />
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add frontend/components/chat/ frontend/app/(dashboard)/chat/
git commit -m "feat: streaming chat page with message bubbles and chat input"
```

---

## Session 5: Anki Card UI + PDF Upload + Deployment

**Exit criteria:** Anki flip-card UI works, PDF upload works, both apps deploy successfully.

---

### Task 18: Anki flip-card components

**Files:**
- Create: `frontend/components/anki/AnkiCard.tsx`
- Create: `frontend/components/anki/AnkiDeckViewer.tsx`
- Create: `frontend/app/(dashboard)/anki/page.tsx`

**Step 1: AnkiCard.tsx (flip animation)**

```tsx
// frontend/components/anki/AnkiCard.tsx
"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import type { AnkiCard as AnkiCardType } from "@/lib/types"

const DIFFICULTY_STYLES = {
  easy: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
  medium: "bg-accent-warning/10 text-accent-warning border-accent-warning/20",
  hard: "bg-accent-error/10 text-accent-error border-accent-error/20",
}

const TYPE_LABEL = {
  concept: "Concept",
  conceptual: "Conceptual",
  clinical: "Clinical",
}

interface Props {
  card: AnkiCardType
  total: number
  current: number
}

export function AnkiCard({ card, total, current }: Props) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-[11px] text-surface-4 font-medium">{current} / {total}</span>
        <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary rounded-full transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${DIFFICULTY_STYLES[card.difficulty]}`}>
            {card.difficulty}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-surface-2 text-surface-4">
            {TYPE_LABEL[card.card_type]}
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full cursor-pointer"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped(f => !f)}
      >
        <motion.div
          style={{ transformStyle: "preserve-3d", position: "relative", height: "280px" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 bg-surface-2 rounded-xl border border-surface-3 flex flex-col items-center justify-center px-8 py-6"
          >
            <span className="text-[11px] text-surface-4 font-medium uppercase tracking-wider mb-4">Question</span>
            <p className="text-neutral text-base font-medium text-center leading-relaxed">{card.front}</p>
            <span className="mt-6 text-[11px] text-surface-4">Click to reveal answer</span>
          </div>

          {/* Back */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className="absolute inset-0 bg-surface-2 rounded-xl border border-brand-primary/30 flex flex-col items-center justify-center px-8 py-6"
          >
            <span className="text-[11px] text-brand-primary font-medium uppercase tracking-wider mb-4">Answer</span>
            <p className="text-neutral text-sm text-center leading-relaxed">{card.back}</p>
          </div>
        </motion.div>
      </div>

      <p className="text-[11px] text-surface-4">Click card to flip</p>
    </div>
  )
}
```

**Step 2: AnkiDeckViewer.tsx (prev/next navigation)**

```tsx
// frontend/components/anki/AnkiDeckViewer.tsx
"use client"
import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AnkiCard } from "./AnkiCard"
import type { AnkiCard as AnkiCardType } from "@/lib/types"

interface Props {
  cards: AnkiCardType[]
  deckTitle: string
  onClose: () => void
}

export function AnkiDeckViewer({ cards, deckTitle, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const card = cards[index]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-[52px] border-b border-surface-2 flex-shrink-0">
        <button onClick={onClose} className="text-surface-4 hover:text-neutral transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-neutral font-semibold flex-1 truncate">{deckTitle}</h2>
        <span className="text-surface-4 text-sm">{cards.length} cards</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8">
        <AnkiCard card={card} total={cards.length} current={index + 1} />
      </div>

      <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-surface-2">
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="w-10 h-10 flex items-center justify-center bg-surface-2 rounded-md hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} className="text-neutral" />
        </button>
        <span className="text-surface-4 text-sm w-24 text-center">{index + 1} of {cards.length}</span>
        <button
          onClick={() => setIndex(i => Math.min(cards.length - 1, i + 1))}
          disabled={index === cards.length - 1}
          className="w-10 h-10 flex items-center justify-center bg-surface-2 rounded-md hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} className="text-neutral" />
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Anki page**

```tsx
// frontend/app/(dashboard)/anki/page.tsx
"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, BookOpen, Trash2 } from "lucide-react"
import { getAnkiDecks, getDeckCards, generateAnki } from "@/lib/api"
import { AnkiDeckViewer } from "@/components/anki/AnkiDeckViewer"
import type { AnkiDeck, AnkiCard } from "@/lib/types"

export default function AnkiPage() {
  const { data: session } = useSession()
  const [decks, setDecks] = useState<AnkiDeck[]>([])
  const [activeDeck, setActiveDeck] = useState<{ deck: AnkiDeck; cards: AnkiCard[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [topic, setTopic] = useState("")
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (session) getAnkiDecks(session).then(setDecks)
  }, [session])

  const handleGenerate = async () => {
    if (!session || !topic.trim()) return
    setGenerating(true)
    try {
      await generateAnki({ topic, max_cards: 20 }, session)
      const updated = await getAnkiDecks(session)
      setDecks(updated)
      setTopic("")
      setShowNew(false)
    } finally {
      setGenerating(false)
    }
  }

  const openDeck = async (deck: AnkiDeck) => {
    if (!session) return
    const cards = await getDeckCards(deck.id, session)
    setActiveDeck({ deck, cards })
  }

  if (activeDeck) {
    return <AnkiDeckViewer cards={activeDeck.cards} deckTitle={activeDeck.deck.title} onClose={() => setActiveDeck(null)} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-[52px] border-b border-surface-2 flex-shrink-0">
        <h1 className="text-neutral font-semibold">Anki Cards</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 rounded-md text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} />
          Generate Deck
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {showNew && (
          <div className="mb-5 p-4 bg-surface-2 rounded-xl border border-surface-3">
            <h3 className="text-neutral font-medium text-sm mb-3">New Anki Deck</h3>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Topic (e.g., Renal physiology, Cardiac arrhythmias)"
              className="w-full bg-surface-3 rounded-lg px-3 py-2 text-sm text-neutral placeholder:text-surface-4 outline-none border border-transparent focus:border-brand-primary transition-colors mb-3"
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 rounded-md text-sm text-white font-medium transition-colors"
              >
                {generating ? "Generating..." : "Generate 15-25 Cards"}
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 bg-surface-3 hover:bg-surface-2 rounded-md text-sm text-surface-4 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {decks.length === 0 && !showNew && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen size={36} className="text-surface-3 mb-3" />
            <p className="text-surface-4 text-sm">No decks yet. Generate your first deck.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => openDeck(deck)}
              className="flex items-center gap-4 p-4 bg-surface-2 hover:bg-surface-3 rounded-xl text-left transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen size={18} className="text-brand-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-neutral text-sm font-medium truncate">{deck.title}</div>
                <div className="text-surface-4 text-[12px] mt-0.5">{deck.card_count} cards · {new Date(deck.created_at).toLocaleDateString()}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add frontend/components/anki/ frontend/app/(dashboard)/anki/
git commit -m "feat: anki flip card UI with framer motion and deck viewer"
```

---

### Task 19: Deployment configuration

**Files:**
- Create: `backend/render.yaml`
- Create: `frontend/vercel.json`
- Create: `backend/Dockerfile`

**Step 1: render.yaml (backend on Render free tier)**

```yaml
# backend/render.yaml
services:
  - type: web
    name: veso-ai-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    plan: free
    envVars:
      - key: NVIDIA_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: NEXTJS_URL
        sync: false
      - key: NEXTAUTH_SECRET
        sync: false
      - key: ENVIRONMENT
        value: production
```

**Step 2: Dockerfile (for Render)**

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model at build time (avoids cold start delay)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 3: vercel.json (frontend)**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "env": {
    "NEXTAUTH_URL": "@nextauth_url",
    "NEXTAUTH_SECRET": "@nextauth_secret",
    "GOOGLE_CLIENT_ID": "@google_client_id",
    "GOOGLE_CLIENT_SECRET": "@google_client_secret",
    "NEXT_PUBLIC_API_URL": "@api_url"
  }
}
```

**Step 4: Deployment steps**

```
BACKEND (Render):
1. Push repo to GitHub
2. Go to render.com → New Web Service → Connect repo
3. Root directory: backend/
4. Build: pip install -r requirements.txt
5. Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
6. Add all env vars from .env.example in Render dashboard
7. Deploy → get URL: https://veso-ai-backend.onrender.com

FRONTEND (Vercel):
1. Go to vercel.com → Import project → Connect repo
2. Root directory: frontend/
3. Add env vars in Vercel dashboard (including NEXT_PUBLIC_API_URL = your Render URL)
4. Deploy → get URL: https://veso-ai.vercel.app

SUPABASE:
1. Create project at supabase.com (free)
2. Run the SQL schema from this plan in the SQL editor
3. Copy project URL + service role key → add to both env files

GOOGLE OAUTH:
1. console.cloud.google.com → Credentials → OAuth 2.0 Client ID
2. Authorized origins: http://localhost:3000, https://veso-ai.vercel.app
3. Authorized redirects: http://localhost:3000/api/auth/callback/google,
                         https://veso-ai.vercel.app/api/auth/callback/google
```

**Step 5: Commit**
```bash
git add backend/render.yaml backend/Dockerfile frontend/vercel.json
git commit -m "chore: deployment config for vercel and render"
```

---

### Task 20: Final .gitignore + knowledge_base .gitkeep

**Files:**
- Verify: `backend/knowledge_base/.gitkeep` exists (already created)
- Verify: `backend/chroma_db/.gitkeep` exists (already created)

**Step 1: Ensure .gitignore covers PDF files and chroma data**

```
# Already in .gitignore — verify these lines exist:
backend/chroma_db/*
!backend/chroma_db/.gitkeep
backend/knowledge_base/*.pdf
```

**Step 2: Final commit**
```bash
git add .
git commit -m "chore: finalize gitignore and placeholder directories"
```

---

## Free Tier Summary

| Service | Plan | Limits |
|---|---|---|
| Vercel | Hobby (free) | Unlimited deploys, 100GB bandwidth/mo |
| Render | Free | 512MB RAM, sleeps after 15min inactivity |
| Supabase | Free | 500MB DB, 1GB file storage, 50MB uploads |
| ChromaDB | Local (persistent on Render disk) | Limited by Render disk (1GB free) |
| HuggingFace Embeddings | Local (all-MiniLM-L6-v2) | Completely free, runs on CPU |
| DuckDuckGo Search | No API key needed | Rate limited but free |
| NVIDIA Kimi-K2.5 | Free credits via nvapi key | Per your existing key |
| NextAuth.js | Free OSS | No limits |
| Google OAuth | Free | No limits |

> **Render cold start**: Free tier sleeps after 15 minutes. First request may take 30-60 seconds. Consider adding a simple "wake up" ping from the frontend or upgrading to Render Starter ($7/mo) for production use.

---

## Session Milestones

| Session | Tasks | Exit Criteria |
|---|---|---|
| 1 | 1-5 | Both apps boot, Google login works, `/api/health` returns 200 |
| 2 | 6-10 | Chat streams Kimi-K2.5 responses with RAG and Supabase history |
| 3 | 11-13 | Search agent, Anki generation, PDF upload all return correct data |
| 4 | 14-17 | App shell renders per spec, chat streams in browser |
| 5 | 18-20 | Anki flip UI works, both apps deployed |
