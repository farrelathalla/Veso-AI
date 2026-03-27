import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_community.vectorstores import Chroma
from app.rag.embeddings import get_embeddings
from pathlib import Path

CHROMA_PATH = Path(__file__).parent.parent.parent / "chroma_db"
COLLECTION_NAME = "medical_knowledge"

_vectorstore: Chroma | None = None


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
    """Return top-k relevant text chunks for a query."""
    vs = get_vectorstore()
    docs = vs.similarity_search(query, k=k)
    return [doc.page_content for doc in docs]


def retrieve_from_source(source: str, k: int = 20) -> list[str]:
    """Return up to k chunks from a specific uploaded file, by metadata filter."""
    vs = get_vectorstore()
    results = vs._collection.get(where={"source": source}, limit=k, include=["documents"])
    return results.get("documents") or []


def add_documents(docs: list) -> None:
    get_vectorstore().add_documents(docs)
