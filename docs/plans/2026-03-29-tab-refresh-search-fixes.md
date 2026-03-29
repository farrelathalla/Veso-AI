# Fix Plan: Tab-Refresh Bug + Search Citation Formatting
**Date:** 2026-03-29

---

## Bug 1 — Chat refreshes on tab switch / alt-tab

### Root cause
`frontend/app/(dashboard)/chat/[id]/page.tsx` has this effect:
```ts
useEffect(() => {
  if (!session || !id) return
  getMessages(id, session)...
}, [session, id])
```
NextAuth's `useSession()` re-validates the session on tab focus, creating a **new object reference** for `session`. This triggers the effect again → full message reload → stream in progress gets clobbered.

### Fix
Add a `fetchedForId` ref. Before fetching, check if we already loaded messages for this `id`. Only skip when the `id` hasn't changed (guard against stale data on actual conversation switch).

**File:** `frontend/app/(dashboard)/chat/[id]/page.tsx`

```ts
const fetchedForId = useRef<string | null>(null)

useEffect(() => {
  if (!session || !id) return
  if (fetchedForId.current === id) return   // ← skip re-fetch on session re-validate
  fetchedForId.current = id
  setLoading(true)
  getMessages(id, session)...
}, [session, id])
```

---

## Bug 2 — Search never includes real URLs in the response body

### Root cause
`search_and_answer` in `backend/app/agents/search_agent.py` passes real search results (which include URLs) to the LLM, but the prompt only says *"answer the following for a medical student"*. The model ignores the actual URLs and generates generic journal guidance (with invented DOI patterns) instead of citing what was actually found.

### Fix
Rewrite the injected user-content in `search_and_answer` to give the LLM an explicit format instruction:

```
For EACH search result above, write one numbered item in this exact format:
N. **[Title]**: [one-sentence description of what this source covers]
   [exact URL from the result — never invent a URL]

Do not write general guidance. Only list sources that were actually returned above.
If a result does not have a useful URL, skip it.
```

---

## Bug 3 — Messy `–––` separators and "how-to guide" formatting

### Root cause (two-part)
1. The LLM produces `–––` horizontal rule lines (em-dash runs). These are not cleaned by `cleanChatText()`.
2. The search prompt (before this fix) lets the LLM go into "guide mode", generating structured explanations instead of direct source links.

### Fix
**Part A — Backend prompt** (same as Bug 2 fix above, covers the guide-mode issue).

**Part B — Frontend cleanup**
Add a line to `cleanChatText()` in `frontend/components/chat/MessageBubble.tsx`:
```ts
// Strip em-dash / en-dash horizontal rule lines (e.g. "–––––––––")
text = text.replace(/^[\u2013\u2014\-]{3,}\s*$/gm, "")
```

---

## Execution order

1. `frontend/app/(dashboard)/chat/[id]/page.tsx` — add `fetchedForId` guard (Bug 1)
2. `backend/app/agents/search_agent.py` — rewrite search prompt to force citation format (Bugs 2 & 3)
3. `frontend/components/chat/MessageBubble.tsx` — add em-dash line cleanup in `cleanChatText` (Bug 3)
