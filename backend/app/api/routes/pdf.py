import json
import os
import re
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from app.api.deps import current_user
from app.rag.pdf_processor import load_file_chunks, summarize_file_text, KNOWLEDGE_BASE_PATH
from app.rag.vector_store import get_vectorstore
from app.services.llm import stream_response

router = APIRouter(prefix="/pdf", tags=["pdf"])

_ALLOWED_EXTENSIONS = {".pdf", ".txt"}
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


def _safe_filename(raw: str) -> str:
    """Strip path components and sanitise to alphanumeric + safe chars only."""
    name = os.path.basename(raw)                         # strip any directory traversal
    name = re.sub(r"[^\w.\-]", "_", name)                # allow only safe characters
    name = re.sub(r"\.{2,}", ".", name)                  # collapse multiple dots
    return name or "upload"


def _validate_extension(filename: str) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only .pdf and .txt files are accepted")


def _resolve_safe_dest(filename: str, prefix: str = "") -> Path:
    """Return a safe destination Path guaranteed to be inside KNOWLEDGE_BASE_PATH."""
    safe = _safe_filename(prefix + filename)
    dest = (KNOWLEDGE_BASE_PATH / safe).resolve()
    # Guard: destination must be inside knowledge_base/
    if not str(dest).startswith(str(KNOWLEDGE_BASE_PATH.resolve())):
        raise HTTPException(400, "Invalid filename")
    return dest


async def _write_limited(file: UploadFile, dest: Path) -> None:
    """Write upload to dest, rejecting if it exceeds size limit."""
    written = 0
    try:
        with open(dest, "wb") as f:
            while True:
                chunk = await file.read(65_536)
                if not chunk:
                    break
                written += len(chunk)
                if written > _MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"File too large (max {_MAX_UPLOAD_BYTES // 1024 // 1024} MB)")
                f.write(chunk)
    except HTTPException:
        if dest.exists():
            dest.unlink()
        raise


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload a .txt or .pdf, ingest into ChromaDB."""
    raw_name = file.filename or "upload.txt"
    _validate_extension(raw_name)
    dest = _resolve_safe_dest(raw_name)
    await _write_limited(file, dest)
    chunks = load_file_chunks(dest)
    get_vectorstore().add_documents(chunks)
    return {"filename": dest.name, "chunks_ingested": len(chunks)}


@router.post("/summarize")
async def summarize_file(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload a .txt or .pdf and stream a medical summary."""
    raw_name = file.filename or "upload.txt"
    _validate_extension(raw_name)
    tmp_path = _resolve_safe_dest(raw_name, prefix="_tmp_")
    try:
        await _write_limited(file, tmp_path)
        text = summarize_file_text(tmp_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

    messages = [{
        "role": "user",
        "content": (
            "Summarise this medical document for a medical student. "
            "Highlight key concepts, mechanisms, pharmacology if present, and clinical pearls. "
            "Use clear headings.\n\n"
            f"{text}"
        ),
    }]

    async def event_gen():
        try:
            async for token in stream_response(messages):
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Summarisation failed'})}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
