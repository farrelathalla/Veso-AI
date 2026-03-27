@AGENTS.md

# Frontend CLAUDE.md

> Read the root `../CLAUDE.md` first. This file covers frontend-specific details only.

---

## Version Warning

This is **Next.js 16.2.1** with **NextAuth v5 beta** and **Tailwind CSS v4**. All three have breaking changes from what most training data covers. Read carefully before writing code.

---

## Running

```bash
cd frontend
cp .env.local.example .env.local   # fill in values
npm install
npm run dev
# → http://localhost:3000
```

---

## Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx                 Root layout — wraps everything in <SessionProvider>
│   ├── page.tsx                   Root redirect: logged in → /chat, else → /login
│   ├── globals.css                Tailwind v4 config (@theme) + base styles + scrollbar
│   ├── api/auth/[...nextauth]/
│   │   └── route.ts               NextAuth v5 route handler
│   ├── (auth)/
│   │   └── login/page.tsx         Google sign-in page
│   └── (dashboard)/
│       ├── layout.tsx             Auth guard (server component) → renders DashboardShell
│       ├── chat/page.tsx          New chat — empty state + streaming
│       ├── chat/[id]/page.tsx     Existing conversation — loads history + streaming
│       └── anki/page.tsx          Anki deck list + generate form (topic, context, file, search)
├── components/
│   ├── DashboardShell.tsx         Client component — owns sidebarOpen state, composes 3-column shell
│   ├── chat/
│   │   ├── MessageBubble.tsx      User/AI bubbles; cleanChatText → renderMarkdown; ankiDeck card
│   │   └── ChatInput.tsx          Textarea + Anki mode + file attach + web search + send button
│   ├── anki/
│   │   ├── AnkiCard.tsx           Single flip card with Framer Motion rotateY animation
│   │   └── AnkiDeckViewer.tsx     Full deck viewer with prev/next nav + progress bar
│   └── sidebar/
│       ├── IconRail.tsx           56px fixed left column — logo, nav icons, hamburger (mobile), user avatar
│       └── ChatListPanel.tsx      260px chat history list — search, hover-delete; overlay on mobile
├── lib/
│   ├── types.ts                   Shared TypeScript interfaces (Conversation, Message, etc.)
│   └── api.ts                     All backend API calls — fetch wrappers + SSE stream parser
├── auth.ts                        NextAuth v5 config — Google provider, jwt + session callbacks
├── vercel.json                    Vercel deployment config
└── .env.local.example             Template for local env vars
```

---

## Tailwind CSS v4 — Important Differences

This project uses **Tailwind v4**, which is configured entirely in CSS, not `tailwind.config.ts`.

All design tokens are defined in `app/globals.css` under `@theme`:

```css
@import "tailwindcss";

@theme {
  --color-brand-primary: #10A37F;
  --color-surface-0: #1E1F22;
  /* ... etc */
}
```

These are used in JSX exactly like regular Tailwind: `bg-brand-primary`, `text-surface-4`, `bg-surface-2`.

**Do not create `tailwind.config.ts`** — it will conflict.

---

## NextAuth v5 — Important Differences

Config lives in `frontend/auth.ts` (not `pages/api/auth/[...nextauth].ts`).

```typescript
// frontend/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({ ... })
```

Usage:
```typescript
// In Server Components / layouts:
import { auth } from "@/auth"
const session = await auth()

// In Client Components:
import { useSession, signIn, signOut } from "next-auth/react"
const { data: session } = useSession()

// Route handler:
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

The session object includes `accessToken` (Google access token) and `refreshToken` added via the `jwt` callback. This token is sent as `Authorization: Bearer <token>` to the backend. Access it as `(session as any).accessToken`.

The Google provider is configured with `authorization: { params: { access_type: "offline", prompt: "consent" } }` to obtain a refresh token on first sign-in. The `jwt` callback auto-refreshes the access token when it is within the expiry window (Google tokens expire after 1 hour; the NextAuth session window is 30 days). If refresh fails, the session is invalidated and the user must sign in again.

---

## App Shell Layout

`(dashboard)/layout.tsx` is a **Server Component** that handles the auth guard via `await auth()`. It renders `<DashboardShell>` and passes page content as `children`.

`components/DashboardShell.tsx` is a **Client Component** that owns `sidebarOpen` state and composes the 3-column shell:

```
┌──────────────────────────────────────────────────────┐
│ IconRail (56px) │ ChatListPanel (256px) │ <main>      │
│ bg-surface-0    │ bg-surface-1          │ bg-surface-1│
└──────────────────────────────────────────────────────┘
```

On **mobile**, `ChatListPanel` renders as a fixed overlay (slides in from the left) when `sidebarOpen` is `true`. The hamburger Menu icon in `IconRail` toggles `sidebarOpen` by calling an `onMenuClick` prop passed down from `DashboardShell`. On **desktop**, the panel is always visible and the hamburger is hidden.

- `IconRail` and `ChatListPanel` are **Client Components** (they use `useSession`, `usePathname`)
- `<main>` is `flex-1 min-w-0 flex flex-col overflow-hidden` — children fill it

---

## SSE Streaming

The `streamChat()` function in `lib/api.ts` uses `fetch` with a `ReadableStream` reader, not `EventSource`. This is because `EventSource` doesn't support custom headers (needed for `Authorization`).

```typescript
// Parse loop pattern — used in streamChat() and uploadAndSummarize()
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ""
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""           // keep incomplete line in buffer
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const json = JSON.parse(line.slice(6))
    // handle json.type: "meta" | "token" | "error" | "done"
  }
}
```

When a new chat sends its first message, the backend responds with a `meta` event containing a `conversation_id`. The frontend stores this ID while streaming continues and calls `router.replace("/chat/<id>")` only after the `done` event fires. Navigating on `meta` caused the component to unmount mid-stream and lose buffered tokens.

---

## Message Type — `lib/types.ts`

```typescript
interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  created_at?: string
  ankiDeck?: { id: string; title: string; card_count: number }
  attachedFile?: string
}
```

- `ankiDeck` — set on assistant messages when the message represents an inline Anki deck card (generated from chat Anki mode). `MessageBubble` checks for this before falling through to `renderMarkdown`.
- `attachedFile` — set on user messages when a file was attached at send time. `MessageBubble` renders a `FileText` badge above the user bubble when present. Persisted via `messages.metadata.attachedFile` in the DB; reconstructed in `[id]/page.tsx` loader.

---

## ChatInput — `components/chat/ChatInput.tsx`

Props:
```typescript
{
  onSend: (message: string, options: { useRag: boolean; useSearch: boolean; attachedFile?: string }) => void
  onSummary?: (text: string) => void
  onAnkiCreated?: (deck: { id: string; title: string; card_count: number }, userMessage: { topic: string; attachedFile?: string }) => void
  disabled?: boolean
  conversationId?: string
}
```

Key behaviours:
- **File attach** — `POST /api/pdf/upload` on file select; shows dismissible badge; stores `attachedFile` filename in state
- **Anki mode** — `BookOpen` icon toggles Anki mode. On submit, calls `generateAnki` directly (not `onSend`/`streamChat`). Captures `topic` and `fileAttached` as local variables **before** clearing state, so the `onAnkiCreated` callback always receives the correct values even after `setText("")` and `setAttachedFile(null)` have run.
- **`onAnkiCreated` signature** — second argument `{ topic, attachedFile }` is the user message info. Both chat pages use this to immediately add the user bubble + deck card to local state without waiting for a DB round-trip.
- **Web search** — `Search` icon toggles `useSearch`; passed through `onSend` options

**Ordering trap fixed:** The previous code passed `attachedFile` state to the callback after clearing it. Always capture `const fileAttached = attachedFile` before any state mutation, then use `fileAttached` in the async callback.

---

## Message Rendering — `components/chat/MessageBubble.tsx`

**Pipeline for AI messages:**
```
raw content string
  → cleanChatText()        strips {{cN::...}}, {{c?}}, §N, Anki workflow lines
  → renderMarkdown()       bold, headings, lists, code blocks, tables, inline code
  → React nodes
```

**`cleanChatText(text)`** — safety net applied before every `renderMarkdown` call:
- `{{c1::answer}}` → `answer`
- `{{c?}}` and any other `{{...}}` → removed
- `§1`, `§2`, `§` → removed
- Lines matching `/need cards\? ask/i`, `/make anki cards from/i`, `/batch.?generate/i` → line removed
- Double spaces introduced by removals → collapsed

**`ankiDeck` rendering** — checked before markdown path. Renders a clickable `Link` card with `BookOpen` icon, title, card count, and "Tap to view your Anki deck" label.

**`attachedFile` on user bubbles** — renders a `FileText` badge above the message bubble text when `message.attachedFile` is present.

---

## Anki Page — `app/(dashboard)/anki/page.tsx`

The "New Anki Deck" form has four context sources (all optional, any combination):
1. **Topic** — required; the subject for card generation
2. **Additional context** — free-text field; paste lecture notes here
3. **Attach file** — `POST /api/pdf/upload` then pass `attached_file` to `generateAnki`. Triggers `retrieve_from_source` on the backend (source-filtered, not semantic search).
4. **Web search** — toggle sends `use_search: true`; backend fetches DuckDuckGo results for the topic and injects them as additional context.

All four are joined on the backend and sent to the Anki card generator together.

State cleanup: file attachment and search toggle reset automatically on successful generation or Cancel.

---

## Chat Page — `app/(dashboard)/chat/[id]/page.tsx`

**Message loader** maps backend response to `Message` type:
```typescript
setMessages(msgs.map(m => ({
  ...m,
  ankiDeck: m.metadata?.ankiDeck ?? undefined,
  attachedFile: m.metadata?.attachedFile ?? undefined,
})))
```

**`handleAnkiCreated`** — adds both user message and deck card to local state immediately:
```typescript
const handleAnkiCreated = (deck, userMessage) => {
  setMessages(prev => [
    ...prev,
    { role: "user", content: userMessage.topic, attachedFile: userMessage.attachedFile },
    { role: "assistant", content: "", ankiDeck: deck },
  ])
}
```
Without this, the user prompt bubble disappeared until reload because the DB round-trip happened server-side but the frontend state was never updated.

---

## Anki Flip Card Animation

`components/anki/AnkiCard.tsx` uses Framer Motion:

```tsx
<motion.div
  animate={{ rotateY: flipped ? 180 : 0 }}
  transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
  style={{ transformStyle: "preserve-3d" }}
>
  {/* Front — backfaceVisibility: "hidden" */}
  {/* Back  — transform: "rotateY(180deg)", backfaceVisibility: "hidden" */}
</motion.div>
```

**Critical:** both faces must have `backfaceVisibility: "hidden"` and `WebkitBackfaceVisibility: "hidden"` as inline styles (not Tailwind classes) — CSS custom properties don't work for these in Safari.

When navigating between cards (`AnkiDeckViewer`), the `key` prop on `<AnkiCard>` is incremented to force a remount and reset the flip state.

---

## Design Rules (from `docs/UI_DESIGN_SPEC.md`)

- No emoji in any UI text (labels, placeholders, tooltips, copy)
- `brand-primary` (#10A37F) used ONLY for: AI avatar, active nav indicator, primary buttons, active states
- User messages: right-aligned, `bg-surface-2`, `rounded-xl rounded-br-sm`
- AI messages: left-aligned, `bg-surface-2`, `rounded-xl rounded-bl-sm`, V avatar in `bg-brand-primary`
- Destructive actions use `accent-error` (#F27474) only
- All spacing is multiples of 4px
- Streaming cursor: `inline-block w-0.5 h-4 bg-brand-primary animate-pulse`

---

## Component Conventions

- All interactive components that use hooks are `"use client"`
- Server Components handle auth guards and initial data fetching
- AI message content is rendered as markdown via inline `renderMarkdown` / `inlineMarkdown` helpers inside `MessageBubble.tsx`. There is **no `react-markdown` dependency** — do not add one.
- The AI sender label is **"Veso AI"** (not "Response" or "Assistant")
- `cleanChatText()` must always run before `renderMarkdown()` — never render raw LLM output directly
- Error states: `bg-accent-error/10 border-l-2 border-accent-error`
- Loading spinner: `w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin`

---

## Common Pitfalls

- **`(session as any).accessToken`** — the accessToken is not on the default NextAuth session type; cast to `any` or extend the type in `auth.ts`
- **`router.replace` vs `router.push`** — use `replace` when changing the URL for the same logical page (e.g., after a new conversation is created), so the back button doesn't loop
- **Tailwind v4 opacity modifiers** — `bg-brand-primary/10` syntax works correctly since tokens are CSS custom properties
- **`useEffect` dependency on `session`** — always include `session` in dependency arrays for effects that fetch from the backend, otherwise they won't fire on login
- **`ChatListPanel` refresh** — the list refreshes on `pathname` change (via `useEffect`) so newly created conversations appear automatically
- **SSE navigation** — always navigate to `/chat/<id>` on the `done` event, never on `meta`. Navigating on `meta` unmounts the streaming component and drops buffered tokens.
- **`DashboardShell` is a Client Component** — do not add `await auth()` or other async server calls inside it. Auth guard logic belongs in `(dashboard)/layout.tsx`.
- **`Message.ankiDeck`** — check for this field before falling through to the markdown renderer. An assistant message with `ankiDeck` set has `content: ""` — rendering empty markdown is harmless but wastes cycles.
- **`Message.attachedFile`** — this is NOT stored in the `Message.content` field. It lives in `metadata.attachedFile` in the DB and is mapped to `message.attachedFile` by the loader. Never try to parse it from content.
- **`onAnkiCreated` second argument** — always pass `{ topic, attachedFile }` as the second argument. Both chat pages use it to render the user bubble immediately. If the second argument is missing, the user prompt disappears until reload.
- **Capture before clear** — in `ChatInput.handleAnkiGenerate`, always capture `const topic = text.trim()` and `const fileAttached = attachedFile` before any `setText("")` or `setAttachedFile(null)` call. State clearing happens synchronously but the callback fires after the async `generateAnki` call.
