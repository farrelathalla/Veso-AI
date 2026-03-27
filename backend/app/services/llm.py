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
- Use simple, clear English — avoid unnecessary complexity"""


def get_llm() -> ChatNVIDIA:
    return ChatNVIDIA(
        model="moonshotai/kimi-k2.5",
        api_key=settings.nvidia_api_key,
        temperature=1,
        top_p=1,
        max_completion_tokens=16384,
    )


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
