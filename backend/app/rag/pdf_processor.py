"""
Document processor — handles both .txt and .pdf files in knowledge_base/.
"""
import hashlib
from pathlib import Path
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent.parent / "knowledge_base"
CHUNK_SIZE = 600
CHUNK_OVERLAP = 60


def _file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def _extract_text(path: Path) -> str:
    """Extract raw text from .txt or .pdf file."""
    if path.suffix.lower() == ".txt":
        return path.read_text(encoding="utf-8", errors="replace")

    if path.suffix.lower() == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            return text
        except Exception as e:
            raise RuntimeError(f"Failed to read PDF {path.name}: {e}")

    raise ValueError(f"Unsupported file type: {path.suffix}")


def load_file_chunks(file_path: Path) -> list[Document]:
    """Extract text from a file and split into overlapping chunks."""
    text = _extract_text(file_path)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.create_documents(
        [text],
        metadatas=[{
            "source": file_path.name,
            "hash": _file_hash(file_path),
            "type": file_path.suffix.lstrip("."),
        }],
    )
    return chunks


def ingest_knowledge_base(vectorstore, already_indexed: set[str]) -> dict:
    """Ingest all .txt and .pdf files in knowledge_base/ that aren't indexed yet."""
    results: dict = {"ingested": [], "skipped": [], "errors": []}

    supported = list(KNOWLEDGE_BASE_PATH.glob("*.txt")) + list(KNOWLEDGE_BASE_PATH.glob("*.pdf"))
    for file_path in supported:
        file_hash = _file_hash(file_path)
        if file_hash in already_indexed:
            results["skipped"].append(file_path.name)
            continue
        try:
            chunks = load_file_chunks(file_path)
            vectorstore.add_documents(chunks)
            results["ingested"].append({"file": file_path.name, "chunks": len(chunks)})
        except Exception as e:
            results["errors"].append({"file": file_path.name, "error": str(e)})

    return results


def summarize_file_text(file_path: Path, max_chars: int = 12_000) -> str:
    """Extract text from a file, capped for LLM context window."""
    return _extract_text(file_path)[:max_chars]
