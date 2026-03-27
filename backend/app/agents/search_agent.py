from duckduckgo_search import DDGS
from app.services.llm import stream_response
from typing import AsyncGenerator


def _run_search(query: str) -> str:
    """Execute a DuckDuckGo search and return formatted results."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
    except Exception as e:
        return f"Search failed: {e}"

    if not results:
        return "No results found."

    formatted = []
    for i, r in enumerate(results, 1):
        formatted.append(
            f"{i}. **{r.get('title', '')}**\n"
            f"   {r.get('href', '')}\n"
            f"   {r.get('body', '')}"
        )
    return "\n\n".join(formatted)


async def search_and_answer(
    query: str,
    history: list[dict],
) -> AsyncGenerator[str, None]:
    """Run a web search, inject results as context, stream a synthesised answer."""
    search_results = _run_search(query)
    messages = list(history)
    content = (
        f"Web search results for: {query}\n\n"
        f"{search_results}"
        f"\n\n---\n\n"
        f"Based on the above search results, answer the following for a medical student:\n{query}"
    )
    messages.append({"role": "user", "content": content})
    async for token in stream_response(messages):
        yield token
