  # Veso AI — Deployment Guide

Backend → **Railway** | Frontend → **Vercel**

---

## Overview

| Service | Platform | Cost | Notes |
|---|---|---|---|
| Backend (FastAPI) | Railway | ~$5/mo (Hobby) | Docker, persistent disk for ChromaDB |
| Frontend (Next.js) | Vercel | Free (Hobby) | Auto-deploys on push |
| Database | Supabase | Free | 500 MB Postgres |
| Embeddings | Inside Railway container | Free | CPU-only, runs on Railway's machine |
| LLM | NVIDIA NIM | Pay-per-use / free credits | Kimi-K2-Instruct |
| Search | DuckDuckGo | Free | No API key needed |

---

## Before You Start

You need all of these before deploying. Get them first.

### 1. NVIDIA API Key

You already have this (`nvapi-...`). Keep it ready.

### 2. Google OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing) → **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. For now, under **Authorised JavaScript origins** add:
   - `http://localhost:3000`
6. Under **Authorised redirect URIs** add:
   - `http://localhost:3000/api/auth/callback/google`
7. Click **Create** → copy the **Client ID** and **Client Secret**

> You'll come back and add the production URLs after Vercel deploys.

### 3. NEXTAUTH_SECRET

Generate a secure random string — run this in your terminal:

```bash
openssl rand -base64 32
```

Save the output. You'll paste it into both the backend and frontend env vars.

### 4. Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project** (free tier)
2. Set a DB password and pick a region close to you
3. Wait for it to provision (~2 min)
4. Go to **Project Settings** → **API**:
   - Copy **Project URL** → this is your `SUPABASE_URL`
   - Copy **service_role** key (the long secret one, **not** the anon key) → this is your `SUPABASE_SERVICE_KEY`

#### Create the database tables

In your Supabase project → **SQL Editor** → **New Query**, paste and run:

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

alter table conversations enable row level security;
alter table messages enable row level security;
alter table anki_decks enable row level security;
alter table anki_cards enable row level security;
```

Click **Run**. All four tables should be created with no errors.

---

## Step 1 — Push to GitHub

Everything must be on GitHub before either platform can deploy it.

```bash
# If you haven't already
git remote add origin https://github.com/YOUR_USERNAME/veso-ai.git
git push -u origin main
```

---

## Step 2 — Deploy Backend on Railway

### 2a. Create a Railway account

Go to [railway.app](https://railway.app) and sign up with GitHub. This lets Railway access your repos directly.

Railway pricing: **Hobby plan is $5/month** with $5 of included usage credit — effectively free for light usage. You need to add a credit card to activate it.

### 2b. Create a new project

1. In Railway dashboard, click **New Project**
2. Select **Deploy from GitHub repo**
3. Find and select your `veso-ai` repository
4. Railway will detect the repo. When it asks, click **Add service** → **GitHub Repo** again if needed, or it may auto-create the service.

### 2c. Set the root directory

Railway needs to know the backend is in a subdirectory:

1. Click on the service Railway just created
2. Go to **Settings** tab
3. Under **Source** → **Root Directory**, type: `backend`
4. Railway will now build from `backend/` and use `backend/Dockerfile`

### 2d. Set environment variables

Still in the service settings, go to the **Variables** tab and add these one by one:

| Variable | Value |
|---|---|
| `NVIDIA_API_KEY` | `nvapi-...` (your key) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...` (the service_role key) |
| `NEXTAUTH_SECRET` | the string you generated with openssl |
| `ENVIRONMENT` | `production` |
| `NEXTJS_URL` | `https://your-app.vercel.app` ← put a placeholder for now, update after Vercel deploys |

> **Do not set `PORT`** — Railway injects it automatically. The `railway.toml` already uses `$PORT`.

### 2e. Deploy

1. Go to the **Deployments** tab
2. Click **Deploy** (or it may have already started)
3. Watch the build logs — the first build takes **5–8 minutes** because it downloads and installs the HuggingFace embedding model during the Docker build step
4. When you see `✓ Deployment successful`, the backend is live

### 2f. Get your Railway URL

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Railway will give you a URL like `veso-ai-backend-production.up.railway.app`
3. Copy this URL — you need it for the frontend

### 2g. Test it

Open a browser and go to:
```
https://veso-ai-backend-production.up.railway.app/api/health
```

You should see:
```json
{"status": "ok"}
```

If it returns an error, check the **Logs** tab in Railway for what went wrong.

---

## Step 3 — Deploy Frontend on Vercel

### 3a. Create a Vercel account

Go to [vercel.com](https://vercel.com) and sign up with GitHub.

### 3b. Import the project

1. In Vercel dashboard, click **Add New** → **Project**
2. Find your `veso-ai` GitHub repository and click **Import**

### 3c. Set the root directory

On the configuration screen:
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: click **Edit** and type `frontend`

### 3d. Set environment variables

Still on the same screen, expand **Environment Variables** and add:

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` ← you'll know this URL once deployed; for the first deploy you can use a placeholder and update it right after |
| `NEXTAUTH_SECRET` | same string you generated with openssl |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |
| `NEXT_PUBLIC_API_URL` | `https://veso-ai-backend-production.up.railway.app` (your Railway URL from Step 2f) |

### 3e. Deploy

Click **Deploy**. The build takes about 1–2 minutes. When done, Vercel shows your URL:
```
https://veso-ai-xxxx.vercel.app
```

---

## Step 4 — Connect Everything

Now that both are deployed, you need to wire them together.

### 4a. Update Railway with the Vercel URL

1. Go back to Railway → your backend service → **Variables**
2. Update `NEXTJS_URL` to your actual Vercel URL: `https://veso-ai-xxxx.vercel.app`
3. Railway will automatically redeploy

### 4b. Update Vercel with the final NEXTAUTH_URL

1. Go to Vercel → your project → **Settings** → **Environment Variables**
2. Update `NEXTAUTH_URL` to your actual Vercel URL: `https://veso-ai-xxxx.vercel.app`
3. Go to **Deployments** → click the three dots on the latest deploy → **Redeploy**

### 4c. Update Google OAuth

Go back to [console.cloud.google.com](https://console.cloud.google.com) → your OAuth credentials:

Under **Authorised JavaScript origins**, add:
```
https://veso-ai-xxxx.vercel.app
```

Under **Authorised redirect URIs**, add:
```
https://veso-ai-xxxx.vercel.app/api/auth/callback/google
```

Click **Save**. Google OAuth changes can take a few minutes to propagate.

---

## Step 5 — Trigger RAG Ingest

ChromaDB on Railway is empty. You need to index your knowledge base files once.

1. Open your deployed app and sign in with Google
2. Open browser DevTools → **Network** tab
3. Click any chat message and find the `Authorization: Bearer xxx` header — copy the token (the part after `Bearer `)
4. Run this in your terminal:

```bash
curl -X POST https://veso-ai-backend-production.up.railway.app/api/rag/ingest \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

You should see a response listing all ingested files and chunk counts.

> This only needs to be done once (or whenever you add new files to `knowledge_base/`). The vectors are stored in Railway's persistent filesystem.

---

## Step 6 — Smoke Test

Go through this checklist after everything is deployed:

- [ ] `GET /api/health` returns `{"status": "ok"}`
- [ ] Can sign in with Google on the frontend
- [ ] Can send a chat message and receive a streaming response
- [ ] Can upload a PDF and ask about it
- [ ] Can generate an Anki deck from the `/anki` page
- [ ] Can generate an Anki deck from chat (Anki mode button)
- [ ] Deck cards appear in chat history after page reload
- [ ] Web search toggle returns current information

---

## Troubleshooting

### Railway build fails at pip install

**Symptom:** Build fails with compiler errors on `pymupdf`, `pydantic`, or `chromadb`.

**Cause:** Wrong Python version in Dockerfile, or a package trying to compile from source.

**Fix:** The `Dockerfile` already pins `python:3.11-slim` which has pre-built wheels for all dependencies. Make sure you haven't changed this line.

---

### Railway build succeeds but `/api/health` returns 502

**Symptom:** App deployed but health check fails.

**Cause:** Usually the app is still starting up (embedding model warm-up takes ~30s on first start).

**Fix:** Wait 60 seconds, then try again. Check the **Logs** tab for any Python tracebacks.

---

### Google sign-in fails with "redirect_uri_mismatch"

**Symptom:** After clicking "Sign in with Google", you get a Google error page.

**Cause:** The redirect URI in Google OAuth doesn't match the one your app is using.

**Fix:** Make sure both of these exact URIs are in your Google OAuth **Authorised redirect URIs**:
```
http://localhost:3000/api/auth/callback/google
https://your-actual-vercel-url.vercel.app/api/auth/callback/google
```

---

### Sign-in works but all API calls return 401

**Symptom:** You're logged in but every request to the backend fails with 401.

**Cause:** Usually `NEXTAUTH_SECRET` differs between frontend and backend, so the token can't be validated. Or `NEXTAUTH_URL` is wrong.

**Fix:**
1. Confirm `NEXTAUTH_SECRET` is the exact same string in both Railway and Vercel env vars
2. Confirm `NEXTAUTH_URL` in Vercel matches your actual Vercel URL (not localhost)
3. Redeploy both after fixing

---

### Anki generation returns "Failed to generate cards"

**Symptom:** Deck generation fails silently or returns the error message.

**Cause:** Usually the NVIDIA API key is wrong or rate-limited, or the topic is too vague.

**Fix:**
1. Check Railway logs for `[anki_agent] generation failed:` lines
2. Verify `NVIDIA_API_KEY` in Railway Variables is correct and starts with `nvapi-`
3. Try a more specific topic (e.g., "Aortic stenosis pathophysiology" instead of "heart")

---

### ChromaDB has no data / RAG returns nothing

**Symptom:** Answers don't reference any knowledge base content. RAG status shows 0 chunks.

**Cause:** You haven't triggered ingest on the production server, or the file wasn't in `knowledge_base/` when you deployed.

**Fix:**
1. Make sure your `.txt`/`.pdf` files are committed to `backend/knowledge_base/` and pushed to GitHub
2. Re-trigger ingest with a fresh token (Step 5 above)
3. Check `GET /api/rag/status` — should show non-zero chunk count and list your files

---

### Railway app sleeps / first request is slow

Railway's Hobby plan keeps your app running 24/7 (unlike Render free tier which sleeps after 15 min). If the first request after a new deploy is slow, it's just the embedding model warming up (~30s). Subsequent requests are fast.

---

## Updating the App

After any code change:

```bash
git add .
git commit -m "your message"
git push origin main
```

- **Railway** auto-deploys on every push to `main` (watches the `backend/` directory)
- **Vercel** auto-deploys on every push to `main` (watches the `frontend/` directory)

No manual steps needed.

---

## Local Development

See the root `README.md` for full local setup instructions. Summary:

```bash
# Backend
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm run dev
```

Make sure `backend/.env` has `NEXTJS_URL=http://localhost:3000` and `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000` for local development.
