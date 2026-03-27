from langchain_community.embeddings import HuggingFaceEmbeddings

_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Singleton HuggingFace embedding model (all-MiniLM-L6-v2).
    Downloads once on first call, runs locally on CPU — completely free."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings
