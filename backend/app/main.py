from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.limiter import limiter
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
    # Hide /docs and /redoc in production
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None if settings.environment == "production" else "/redoc",
    openapi_url=None if settings.environment == "production" else "/openapi.json",
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
        headers={"Retry-After": "60"},
    )


# ── Security headers ───────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "0"  # modern best practice: disable legacy filter
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


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
