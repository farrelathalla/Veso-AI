from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, chat, anki, pdf, rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm the embedding model so the first request isn't slow
    from app.rag.embeddings import get_embeddings
    get_embeddings()
    yield


app = FastAPI(
    title="Veso AI Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_origins = [settings.nextjs_url]
if settings.environment == "production":
    _origins += ["https://*.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Anchored, limited-charset regex — prevents ReDoS and unintended origin matching
    allow_origin_regex=r"^https://[a-zA-Z0-9\-]+\.vercel\.app$" if settings.environment == "production" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(anki.router, prefix="/api")
app.include_router(pdf.router, prefix="/api")
app.include_router(rag.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
