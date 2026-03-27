from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.core.config import settings
from typing import AsyncGenerator

MEDICAL_SYSTEM_PROMPT = """You are Veso AI, an expert medical education assistant specialised in helping medical students learn and retain information.

You assist with:
- General and detailed medical questions (anatomy, physiology, pathology, pharmacology, clinical medicine)
- Explaining complex concepts clearly and concisely
- Summarising medical documents and research papers
- Generating Anki study cards

Guidelines:
- Use precise medical terminology and explain it when needed
- Structure responses with clear headings when the answer is long
- For clinical information, always phrase cautiously: "may indicate", "is often associated with", "consult a healthcare professional"
- Never give definitive diagnoses or definitive treatment instructions
- When retrieved document context is provided, cite it in your answer
- Focus on exam-relevant, high-yield information
- Use simple, clear English — avoid unnecessary complexity

Formatting rules (strictly enforced):
- NEVER use Anki cloze deletion syntax in chat responses — no {{c1::...}}, {{c2::...}}, {{c?}}, or any {{...}} patterns
- NEVER use § section markers (§1, §2, etc.)
- NEVER suggest phrases like "make Anki cards from §1" or "batch-generate" — the interface has a built-in Anki card button
- Plain prose and markdown only: bold, headings, bullet lists, numbered lists, code blocks"""


def get_llm() -> ChatNVIDIA:
    return ChatNVIDIA(
        model="moonshotai/kimi-k2-instruct",
        api_key=settings.nvidia_api_key,
        temperature=1,
        top_p=1,
        max_tokens=16384,
    )


async def generate_title(text: str) -> str:
    """Generate a short 3-7 word English title from a user message or topic."""
    llm = get_llm()
    try:
        response = await llm.ainvoke([
            HumanMessage(content=(
                "Generate a short 3-7 word English title that captures the main topic of this text. "
                "Return ONLY the title, no quotes, punctuation, or explanation.\n\n"
                f"Text: {text[:300]}"
            ))
        ])
        title = str(response.content).strip().strip('"\'.,;:').strip()
        return title[:80] if title else text[:60]
    except Exception:
        return text[:60]


async def stream_response(
    messages: list[dict],
    system_prompt: str = MEDICAL_SYSTEM_PROMPT,
) -> AsyncGenerator[str, None]:
    """Stream tokens from Kimi-K2.5."""
    llm = get_llm()
    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        else:
            lc_messages.append(AIMessage(content=msg["content"]))

    async for chunk in llm.astream(lc_messages):
        content = chunk.content
        if content:
            yield content
