from fastapi import APIRouter, Depends, Request
from app.api.deps import current_user
from app.core.limiter import limiter
from app.rag.pdf_processor import ingest_knowledge_base
from app.rag.vector_store import get_vectorstore

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/ingest")
@limiter.limit("5/minute")
async def ingest(request: Request, user=Depends(current_user)):
    """Ingest all new .txt/.pdf files from knowledge_base/ into ChromaDB."""
    vs = get_vectorstore()
    collection = vs._collection
    existing = collection.get(include=["metadatas"])
    already_indexed = {
        m.get("hash", "") for m in (existing.get("metadatas") or []) if m
    }
    result = ingest_knowledge_base(vs, already_indexed)
    return result


@router.get("/status")
@limiter.limit("30/minute")
async def status(request: Request, user=Depends(current_user)):
    """Return indexing status: chunk count and list of indexed source files."""
    vs = get_vectorstore()
    collection = vs._collection
    count = collection.count()
    existing = collection.get(include=["metadatas"]) if count > 0 else {"metadatas": []}
    unique_files = sorted({
        m.get("source", "") for m in (existing.get("metadatas") or []) if m
    } - {""})
    return {
        "indexed_chunks": count,
        "indexed_files": unique_files,
        "total_files": len(unique_files),
    }
