import re
from duckduckgo_search import DDGS
from app.services.llm import stream_response
from app.core.config import settings
from typing import AsyncGenerator

# Keywords that indicate the user wants journal/research results
_JOURNAL_KEYWORDS = re.compile(
    r"\b(journal|study|research|pubmed|paper|clinical\s+trial|meta.?analysis|"
    r"systematic\s+review|evidence|doi|rct|randomized|cohort|case\s+study|lancet|nejm|bmj)\b",
    re.IGNORECASE,
)


def _is_journal_query(query: str) -> bool:
    return bool(_JOURNAL_KEYWORDS.search(query))


def _tavily_search(query: str, max_results: int = 5, domains: list[str] | None = None) -> list[dict]:
    """Search via Tavily API (reliable, designed for AI agents)."""
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.tavily_api_key)
        kwargs: dict = {"max_results": max_results}
        if domains:
            kwargs["include_domains"] = domains
        response = client.search(query, **kwargs)
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "body": r.get("content", ""),
            }
            for r in response.get("results", [])
        ]
    except Exception:
        return []


def _ddg_search(query: str, max_results: int = 5) -> list[dict]:
    """DuckDuckGo fallback (scraper — unreliable on hosted servers)."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return [{"title": r.get("title", ""), "url": r.get("href", ""), "body": r.get("body", "")} for r in results]
    except Exception:
        return []


def _run_search(query: str, max_results: int = 5) -> list[dict]:
    """Primary search: Tavily if key is set, DuckDuckGo otherwise."""
    if settings.tavily_api_key:
        return _tavily_search(query, max_results=max_results)
    return _ddg_search(query, max_results=max_results)


def _run_scholar_search(query: str) -> list[dict]:
    """Search academic sources (PubMed, ResearchGate, PMC)."""
    if settings.tavily_api_key:
        # Tavily supports domain filtering — directly target academic sources
        return _tavily_search(
            query,
            max_results=5,
            domains=["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "researchgate.net"],
        )
    # DDG fallback: separate targeted queries (site: OR syntax is unreliable in DDG)
    results: list[dict] = []
    seen_urls: set[str] = set()
    for targeted in [f"pubmed {query}", f"researchgate {query} study"]:
        for r in _ddg_search(targeted, max_results=3):
            if r["url"] not in seen_urls:
                results.append(r)
                seen_urls.add(r["url"])
    return results


def format_results_for_llm(results: list[dict]) -> str:
    """Format structured results as markdown context for the LLM."""
    if not results:
        return "No results found."
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(
            f"{i}. **{r['title']}**\n"
            f"   {r['url']}\n"
            f"   {r['body']}"
        )
    return "\n\n".join(lines)


def get_sources(results: list[dict]) -> list[dict]:
    """Extract title+url pairs for the sources panel."""
    return [{"title": r["title"], "url": r["url"]} for r in results if r.get("url")]


async def search_and_answer(
    query: str,
    history: list[dict],
) -> tuple[AsyncGenerator[str, None], list[dict]]:
    """Run a web search, stream a synthesised answer, and return sources.

    Returns (token_generator, sources_list) so caller can emit a sources SSE event.
    """
    results = _run_search(query)
    if _is_journal_query(query):
        scholar = _run_scholar_search(query)
        # Merge, deduplicate by URL
        seen_urls = {r["url"] for r in results}
        for r in scholar:
            if r["url"] not in seen_urls:
                results.append(r)
                seen_urls.add(r["url"])

    sources = get_sources(results)
    formatted = format_results_for_llm(results)

    messages = list(history)
    if results:
        content = (
            f"Web search results for: {query}\n\n"
            f"{formatted}"
            f"\n\n---\n\n"
            f"Using the search results above, answer this query for a medical student: {query}\n\n"
            f"List EVERY result that has a URL. For each one write:\n"
            f"N. **[Title]**: [one-sentence description of what the source covers]\n"
            f"   [exact URL — copy it verbatim, never change or invent a URL]\n\n"
            f"Do NOT invent URLs or sources not in the list above. "
            f"After the numbered list add 1-2 sentences of context if helpful."
        )
    else:
        # Search returned nothing — answer from knowledge and be transparent
        content = (
            f"A live web search for '{query}' returned no results right now "
            f"(the search service may be temporarily unavailable). "
            f"Please answer the question for a medical student based on your training knowledge, "
            f"and note clearly that this is from general knowledge rather than live search results.\n\n"
            f"Question: {query}"
        )
    messages.append({"role": "user", "content": content})

    async def _stream():
        async for token in stream_response(messages):
            yield token

    return _stream(), sources
