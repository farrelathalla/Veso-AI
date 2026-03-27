# Knowledge Base

Drop your medical PDFs and research papers here.

This folder is the source for the RAG (Retrieval-Augmented Generation) pipeline.
All `.pdf` files placed here will be automatically ingested into the ChromaDB
vector store when the backend starts (or when the `/api/rag/ingest` endpoint is called).

## Supported Formats
- PDF (`.pdf`)

## Recommended Sources
- Harrison's Principles of Internal Medicine
- Robbins & Cotran Pathologic Basis of Disease
- Gray's Anatomy
- First Aid for the USMLE
- UpToDate clinical summaries (PDF exports)
- PubMed research papers
- Medical textbook chapters

## Notes
- Large PDFs (>50MB) may take longer to process on first ingest
- Files are chunked at 500 tokens with 50 token overlap
- Re-running ingest on an already-indexed file will skip it (deduplication by filename hash)
- This folder is listed in `.gitignore` (contents not committed) — add your own PDFs locally
