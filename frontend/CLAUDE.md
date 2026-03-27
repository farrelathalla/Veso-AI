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
│       ├── layout.tsx             Auth guard (server) + 3-column shell
│       ├── chat/page.tsx          New chat — empty state + streaming
│       ├── chat/[id]/page.tsx     Existing conversation — loads history + streaming
│       └── anki/page.tsx          Anki deck list + generate form
├── components/
│   ├── chat/
│   │   ├── MessageBubble.tsx      User (right) + AI (left) bubbles with streaming cursor
│   │   └── ChatInput.tsx          Textarea + search toggle + file upload + send button
│   ├── anki/
│   │   ├── AnkiCard.tsx           Single flip card with Framer Motion rotateY animation
│   │   └── AnkiDeckViewer.tsx     Full deck viewer with prev/next nav + progress bar
│   └── sidebar/
│       ├── IconRail.tsx           56px fixed left column — logo, nav icons, user avatar
│       └── ChatListPanel.tsx      260px chat history list — search, hover-delete
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

The session object includes `accessToken` (Google access token) added via the `jwt` callback. This token is sent as `Authorization: Bearer <token>` to the backend. Access it as `(session as any).accessToken`.

---

## App Shell Layout

The `(dashboard)/layout.tsx` composes the 3-column shell:

```
┌──────────────────────────────────────────────────────┐
│ IconRail (56px) │ ChatListPanel (256px) │ <main>      │
│ bg-surface-0    │ bg-surface-1          │ bg-surface-1│
└──────────────────────────────────────────────────────┘
```

- `IconRail` and `ChatListPanel` are **Client Components** (they use `useSession`, `usePathname`)
- The layout itself is a **Server Component** that does the auth guard via `await auth()`
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

When a new chat sends its first message, the backend responds with a `meta` event containing a `conversation_id`. The frontend calls `router.replace("/chat/<id>")` at that point.

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
- No `dangerouslySetInnerHTML` anywhere — all text is rendered as plain text or `whitespace-pre-wrap`
- Error states use `bg-accent-error/10 border-l-2 border-accent-error` styling
- Loading states use a `w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin` spinner

---

## Common Pitfalls

- **`(session as any).accessToken`** — the accessToken is not on the default NextAuth session type; cast to `any` or extend the type in `auth.ts`
- **`router.replace` vs `router.push`** — use `replace` when changing the URL for the same logical page (e.g., after a new conversation is created), so the back button doesn't loop
- **Tailwind v4 opacity modifiers** — `bg-brand-primary/10` syntax works correctly since tokens are CSS custom properties
- **`useEffect` dependency on `session`** — always include `session` in dependency arrays for effects that fetch from the backend, otherwise they won't fire on login
- **`ChatListPanel` refresh** — the list refreshes on `pathname` change (via `useEffect`) so newly created conversations appear automatically
