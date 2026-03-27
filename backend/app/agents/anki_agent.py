import json
import re
from langchain_core.messages import SystemMessage, HumanMessage
from app.services.llm import get_llm

ANKI_SYSTEM_PROMPT = """You are a medical education specialist creating high-quality Anki flashcards for medical students preparing for board exams (USMLE, PLAB, etc.).

Card rules:
- Generate between {min_cards} and {max_cards} cards total — no more, no less
- Mix card types: "concept" (direct fact/definition), "conceptual" (mechanism/understanding), "clinical" (applied/case-based)
- Tag each card with difficulty: "easy", "medium", or "hard"
- Prioritise high-yield, exam-relevant concepts
- Use simple, clear English — avoid unnecessary jargon
- No repetition — every card tests a distinct, non-overlapping point
- Front: one focused question or prompt (1-2 sentences max)
- Back: concise accurate answer (1-6 sentences or a short numbered list)
- For clinical information on the back, use cautious phrasing:
    "may indicate", "is often associated with", "consult a healthcare professional"
- Do NOT give definitive diagnoses or prescribe treatment
- Only use facts from the provided context; never hallucinate
- If no context is provided, use your general medical knowledge accurately

Output ONLY a valid JSON array. No markdown fences. No explanation text before or after.

Example output:
[
  {
    "front": "What is the primary function of the loop of Henle?",
    "back": "Concentration of urine via countercurrent multiplication. The descending limb is permeable to water; the ascending limb is impermeable to water but actively transports NaCl out.",
    "difficulty": "medium",
    "card_type": "concept"
  },
  {
    "front": "A patient presents with polyuria, polydipsia, and dilute urine. ADH levels are low. What condition may this indicate?",
    "back": "This presentation may indicate central diabetes insipidus. Consult a healthcare professional for diagnosis and management.",
    "difficulty": "hard",
    "card_type": "clinical"
  }
]"""

_VALID_TYPES = {"concept", "conceptual", "clinical"}
_VALID_DIFFS = {"easy", "medium", "hard"}


def _extract_json(raw: str) -> list:
    """Strip markdown fences and parse JSON array from model output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to find the JSON array inside messy output
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from model output. Raw (first 300 chars): {raw[:300]}")


def _sanitize_cards(raw_cards: list, max_cards: int) -> list[dict]:
    sanitized = []
    seen_fronts: set[str] = set()

    for card in raw_cards[:max_cards]:
        if not isinstance(card, dict):
            continue
        front = str(card.get("front", "")).strip()
        back = str(card.get("back", "")).strip()
        if not front or not back:
            continue
        # Deduplicate by normalised front
        key = front.lower()
        if key in seen_fronts:
            continue
        seen_fronts.add(key)

        sanitized.append({
            "front": front,
            "back": back,
            "difficulty": card.get("difficulty") if card.get("difficulty") in _VALID_DIFFS else "medium",
            "card_type": card.get("card_type") if card.get("card_type") in _VALID_TYPES else "concept",
        })

    return sanitized


async def generate_anki_cards(
    topic: str,
    context: str = "",
    max_cards: int = 20,
) -> list[dict]:
    """Call Kimi-K2.5 to generate Anki cards as validated, sanitised dicts."""
    min_cards = max(15, max_cards - 5)
    llm = get_llm()

    system = ANKI_SYSTEM_PROMPT.format(min_cards=min_cards, max_cards=max_cards)
    user_content = f"Topic: {topic}\n\nRequested cards: {max_cards}"
    if context:
        # Cap context to avoid exceeding token limits
        user_content += f"\n\nSource material:\n{context[:10_000]}"

    messages = [
        SystemMessage(content=system),
        HumanMessage(content=user_content),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw_cards = _extract_json(response.content)
        return _sanitize_cards(raw_cards, max_cards)
    except (ValueError, json.JSONDecodeError):
        return []  # Caller checks for empty list and returns user-friendly error
