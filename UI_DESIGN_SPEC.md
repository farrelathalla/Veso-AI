# Veso AI — UI Design Specification

> Reference document for building the Veso AI chatbot interface. Every layout decision, color token, spacing rule, and component spec is defined here. Follow this document to ensure the UI is pixel-consistent with the approved design.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout Grid](#4-spacing--layout-grid)
5. [App Shell & Layout](#5-app-shell--layout)
6. [Navigation Sidebar (Icon Rail)](#6-navigation-sidebar-icon-rail)
7. [Chat List Panel](#7-chat-list-panel)
8. [Main Chat Area](#8-main-chat-area)
9. [Message Bubbles](#9-message-bubbles)
10. [Input Bar](#10-input-bar)
11. [Interactive States](#11-interactive-states)
12. [Component Reference](#12-component-reference)
13. [Iconography Rules](#13-iconography-rules)
14. [Do's and Don'ts](#14-dos-and-donts)

---

## 1. Design Philosophy

- **Dark-first**: The entire UI lives on a dark surface. No light mode variant unless explicitly added later.
- **Calm & focused**: The interface recedes so the conversation is the focus. Decorative elements are minimal.
- **Consistent density**: Padding is generous but not wasteful. Every element has room to breathe.
- **No emojis in UI copy**: Interface text (labels, placeholders, tooltips) must never contain emoji characters.
- **Green as intent**: Brand green (#10A37F) is used only for primary actions, active states, and the AI identity. Never for decorative purposes.

---

## 2. Color System

### 2.1 Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#10A37F` | Primary buttons, active nav indicator, AI avatar background, active tab border, key interactive elements |
| `brand-dark` | `#1E1F22` | Page-level background, deepest surface |

### 2.2 Functional / Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `surface-0` | `#1E1F22` | App root background, icon rail background |
| `surface-1` | `#282A2E` | Chat list panel background, modal overlays |
| `surface-2` | `#3F424A` | Message bubble backgrounds, card surfaces |
| `surface-3` | `#4B4F5B` | Input field background, secondary card |
| `surface-4` | `#858B9D` | Disabled text, placeholder, muted meta |
| `surface-5` | `#ABABAB` | Secondary text, timestamps, subtext |
| `functional-tint` | `#D8EFE9` | Light green tint for AI badge backgrounds, hover tint on brand elements |

### 2.3 Accent Colors

| Token | Hex | Usage |
|---|---|---|
| `accent-warning` | `#FEC553` | Warning badges, caution states |
| `accent-error` | `#F27474` | Error states, destructive action confirmations, delete prompts |

### 2.4 Neutral

| Token | Hex | Usage |
|---|---|---|
| `neutral-base` | `#F4F4F4` | Primary text on dark surfaces, icon fill on dark backgrounds |

### 2.5 Text Colors (derived)

| Role | Value |
|---|---|
| Primary text | `#F4F4F4` |
| Secondary text | `#ABABAB` |
| Muted / placeholder | `#858B9D` |
| Disabled | `#4B4F5B` |
| Inverted (on light surface) | `#1E1F22` |

### 2.6 Color Usage Rules

- Never use `brand-primary` as a text color on dark backgrounds unless it is a link or labeled action.
- `functional-tint` (#D8EFE9) is only used as a **background tint**, never as a foreground color on its own.
- `accent-error` (#F27474) must appear paired with a clear destructive action label. Never use it decoratively.
- `accent-warning` (#FEC553) is reserved for status indicators and alert badges only.
- Surfaces stack: `surface-0` < `surface-1` < `surface-2` < `surface-3`. Never skip a level.

---

## 3. Typography

### 3.1 Font Stack

```
Primary: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
Monospace (code blocks): "JetBrains Mono", "Fira Code", "Cascadia Code", monospace
```

### 3.2 Type Scale

| Role | Size | Weight | Line Height | Color Token |
|---|---|---|---|---|
| Page title / Panel header | 16px | 600 (SemiBold) | 24px | `neutral-base` |
| Section label | 12px | 600 (SemiBold) | 16px | `surface-5` (uppercase) |
| Chat item name | 14px | 500 (Medium) | 20px | `neutral-base` |
| Chat item preview | 13px | 400 (Regular) | 18px | `surface-5` |
| Message body | 14px | 400 (Regular) | 22px | `neutral-base` |
| Message sender label | 13px | 600 (SemiBold) | 18px | `neutral-base` |
| Timestamp / meta | 11px | 400 (Regular) | 16px | `surface-4` |
| Button label | 13px | 500 (Medium) | 18px | context-dependent |
| Input text | 14px | 400 (Regular) | 22px | `neutral-base` |
| Placeholder text | 14px | 400 (Regular) | 22px | `surface-4` |
| Date separator | 12px | 500 (Medium) | 16px | `surface-5` |

### 3.3 Rules

- Never use font sizes below 11px.
- Section labels (e.g., "CHATS", "SAVED") are always `text-transform: uppercase` at 11–12px / 600 weight.
- Do not mix more than two font weights in a single UI component.
- Line height is always at least 1.4x the font size.

---

## 4. Spacing & Layout Grid

### 4.1 Base Unit

All spacing is a multiple of **4px**.

| Token | Value | Common Use |
|---|---|---|
| `space-1` | 4px | Icon internal padding, micro gaps |
| `space-2` | 8px | Tight item spacing, icon-to-label gap |
| `space-3` | 12px | Default item padding (vertical) |
| `space-4` | 16px | Standard component padding |
| `space-5` | 20px | Section padding, message padding |
| `space-6` | 24px | Panel header height contribution |
| `space-8` | 32px | Large section gaps |
| `space-10` | 40px | Panel top/bottom padding |

### 4.2 Border Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | Badges, small chips |
| `radius-md` | 8px | Buttons, input fields, small cards |
| `radius-lg` | 12px | Message bubbles, modal cards |
| `radius-xl` | 16px | Panel containers, large cards |
| `radius-full` | 9999px | Avatar circles, pill tabs, toggle switches |

### 4.3 Layout Columns

The app uses a **three-column shell**:

| Column | Width | Min Width |
|---|---|---|
| Icon Rail (col 1) | 56px | 56px (fixed) |
| Chat List Panel (col 2) | 260px | 220px |
| Main Chat Area (col 3) | Remaining (flex-fill) | 480px |

---

## 5. App Shell & Layout

```
+------------------------------------------+
|  Icon Rail  |  Chat List  |  Main Chat   |
|   56px      |   260px     |   flex       |
|             |             |              |
|  (nav)      |  (history)  |  (messages)  |
+------------------------------------------+
```

- The entire shell has `background: #1E1F22`.
- The Chat List Panel has `background: #282A2E`.
- The Main Chat Area has `background: #282A2E` with slightly lighter message surfaces.
- There are **no visible borders** between columns — depth is conveyed through background color contrast only.
- The app shell has a subtle **outer box shadow** and **border-radius: 12px** when rendered in a windowed/desktop context.
- Minimum app window width: **800px**.

---

## 6. Navigation Sidebar (Icon Rail)

### 6.1 Structure

```
+----------+
| [Logo]   |  <- top, 56px × 56px brand mark
|----------|
| [Icon]   |  <- nav icon (e.g., Chat)
| [Icon]   |  <- nav icon (e.g., Explore/Stars)
| [Icon]   |  <- nav icon (additional)
|          |
|   ...    |  <- flex spacer
|          |
| [Avatar] |  <- user profile, bottom
+----------+
```

### 6.2 Specs

- Width: **56px** fixed.
- Background: `#1E1F22` (same as root, creates flush appearance).
- Each icon button: **40px × 40px** clickable area, centered in the 56px column.
- Icon size: **20px × 20px**.
- Default icon color: `#858B9D` (surface-4).
- Active icon color: `#10A37F` (brand-primary).
- Hover: background tint `rgba(255,255,255,0.06)`, border-radius `radius-md` (8px).
- Active state: left-side vertical bar indicator, **3px wide**, `#10A37F`, fully rounded, height 20px.
- Logo area: **56px × 56px**, centered, uses brand icon — no text.
- User avatar: **32px × 32px**, `border-radius: radius-full`, placed 12px from bottom.
- Vertical padding between icons: `space-2` (8px).

---

## 7. Chat List Panel

### 7.1 Header

```
My Chats                    [+] [...]
```

- Height: **52px**.
- Padding: `space-4` (16px) horizontal.
- Title: 16px / 600 / `#F4F4F4`.
- `[+]` button: 28px × 28px, icon-only, `background: #3F424A`, `border-radius: radius-md`, icon color `#F4F4F4`.
- `[...]` button: same size, `background: transparent` default, same hover.
- Gap between title and buttons: auto (flex space-between).

### 7.2 Tabs

```
[ CHATS  24 ]   [ SAVED  24 ]
```

- Tab row height: **36px**.
- Padding: `space-1` (4px) vertical, `space-4` (16px) horizontal on each tab.
- Tab background: transparent.
- Active tab: bottom border `2px solid #10A37F`, text color `#F4F4F4`.
- Inactive tab: no border, text color `#858B9D`.
- Count badge: inline next to label, `font-size: 11px`, `font-weight: 600`, color inherits tab text color.
- Tab separator: a 1px vertical line `#3F424A` between tabs.
- Tab row bottom border: `1px solid #3F424A`.

### 7.3 Search Bar

- Height: **36px**.
- Margin: `space-3` (12px) top/bottom, `space-4` (16px) horizontal.
- Background: `#3F424A`.
- Border: none.
- Border-radius: `radius-full` (pill shape).
- Left icon: search icon, 16px, `#858B9D`.
- Placeholder: "Search...", `#858B9D`.
- Input text: 14px / `#F4F4F4`.
- Focus: border `1px solid #10A37F`.

### 7.4 Chat List Item

```
[ Avatar ] Chat Title               [timestamp]
           Preview text preview...
```

- Item height: ~**60px** (auto with padding).
- Padding: `space-3` (12px) vertical, `space-4` (16px) horizontal.
- Avatar: **32px × 32px**, `border-radius: radius-full`.
  - If AI-generated chat: green dot or colored circle, background `#10A37F`.
  - Custom avatar: user-supplied image.
- Chat title: 14px / 500 / `#F4F4F4`.
- Preview text: 13px / 400 / `#858B9D`, max 2 lines, truncate with ellipsis.
- Timestamp: 11px / 400 / `#858B9D`, right-aligned, top row.
- Active item background: `#3F424A`.
- Hover background: `rgba(255,255,255,0.04)`.
- Unread indicator: small filled dot, 6px, `#10A37F`, right of title.
- "New" badge: pill `background: #10A37F`, text `#F4F4F4`, 10px / 600 / uppercase.
- Gap between avatar and text block: `space-3` (12px).
- Divider between items: none (spacing only).

---

## 8. Main Chat Area

### 8.1 Header

```
Warning Messages Samples              [search] [...]
```

- Height: **52px**.
- Padding: `space-5` (20px) horizontal.
- Background: `#282A2E`.
- Bottom border: `1px solid #3F424A`.
- Title: 16px / 600 / `#F4F4F4`.
- Right-side icon buttons: 32px × 32px each, `border-radius: radius-md`, `background: transparent`.
- Icon color: `#858B9D`, hover `#F4F4F4`.
- Gap between icons: `space-2` (8px).

### 8.2 Message Feed

- Background: `#282A2E`.
- Padding: `space-5` (20px) horizontal, `space-4` (16px) vertical (top/bottom of scroll container).
- Messages are laid out top-to-bottom, newest at bottom.
- Gap between message groups (user + response): `space-5` (20px).
- Gap between consecutive same-sender messages: `space-2` (8px).

### 8.3 Date Separator

```
          ——— Today ———
```

- Centered horizontally.
- Text: 12px / 500 / `#858B9D`.
- Lines: `1px solid #3F424A`, extending left and right via flex/grid.
- Margin: `space-5` (20px) top and bottom.

---

## 9. Message Bubbles

### 9.1 User Message

```
                              [ User Avatar ]
             [ message text content here ]
```

- Alignment: **right-aligned**, pushed to the right side.
- Avatar: 28px × 28px, `border-radius: radius-full`, positioned top-right of bubble group.
- Bubble background: `#3F424A`.
- Bubble padding: `space-3` (12px) vertical, `space-4` (16px) horizontal.
- Bubble border-radius: `radius-lg` (12px), with bottom-right corner `radius-sm` (6px) — "tail" effect.
- Text: 14px / 400 / `#F4F4F4`.
- Max bubble width: **65%** of message feed width.
- Sender name: 13px / 600 / `#F4F4F4`, shown above bubble, aligned right.
- Timestamp: 11px / `#858B9D`, shown below bubble, aligned right.
- Edit indicator icon: small pencil icon, 12px, `#858B9D`, inline after message text.
- Action row (on hover): appears below bubble — emoji react button, aligned left.

### 9.2 AI Response Message

```
[ AI Icon ]  Response
             [ message text content here ]
             [ numbered list items... ]
```

- Alignment: **left-aligned**.
- AI icon: 28px × 28px, `border-radius: radius-full`, `background: #10A37F`, contains brand mark in white.
- "Response" label: 13px / 600 / `#F4F4F4`, shown at top of bubble as header.
- Bubble background: `#3F424A`.
- Bubble padding: `space-3` (12px) vertical, `space-4` (16px) horizontal.
- Bubble border-radius: `radius-lg` (12px), with bottom-left corner `radius-sm` (6px).
- Text: 14px / 400 / `#F4F4F4`, line-height 22px.
- Max bubble width: **75%** of message feed width.
- Timestamp: 11px / `#858B9D`, shown inline in header row, right side.
- Token count badge: small pill `background: #3F424A`, border `1px solid #4B4F5B`, text `#858B9D`, 11px / 500 — shown in header row, right side.

### 9.3 Response Action Row

Appears **below the AI bubble**, always visible (not hover-only):

```
[ emoji ] [ emoji ]          [ Generate Response ] [ Copy ] [ ... ]
```

- Left side: emoji reaction buttons, each 28px × 28px, `border-radius: radius-md`.
- Right side: text action buttons.
- Action button style: `background: #3F424A`, `border-radius: radius-md`, padding `space-1` (4px) `space-3` (12px), height 28px.
- Button text: 12px / 500 / `#858B9D`.
- Button icon: 14px, `#858B9D`, left of label with 4px gap.
- Button hover: `background: #4B4F5B`, text `#F4F4F4`.
- Gap between action buttons: `space-2` (8px).

### 9.4 List Items in AI Messages

- Numbered or bulleted lists use standard markdown rendering.
- List item number: `#10A37F` (brand-primary), bold.
- List item text: `#F4F4F4`, 14px.
- Indentation: `space-5` (20px) left padding.
- Line gap between items: `space-2` (8px).

---

## 10. Input Bar

```
+--------------------------------------------------+
| [attachment?]  Ask questions, or type / ...  [>] [mic] |
+--------------------------------------------------+
```

- Position: **fixed bottom** of the main chat area.
- Background: `#282A2E`.
- Top border: `1px solid #3F424A`.
- Padding: `space-4` (16px) horizontal, `space-3` (12px) vertical.
- Inner input container:
  - Background: `#3F424A`.
  - Border-radius: `radius-xl` (16px).
  - Min-height: **48px**.
  - Padding: `space-3` (12px) vertical, `space-4` (16px) horizontal.
  - Border: `1px solid transparent`.
  - Focus: border `1px solid #10A37F`.
- Placeholder text: "Ask questions, or type / for commands" — 14px / `#858B9D`.
- Input text: 14px / `#F4F4F4`.
- Send button:
  - Size: **32px × 32px**.
  - Background: `#10A37F` (active when text is present), `#4B4F5B` (empty/disabled).
  - Border-radius: `radius-md` (8px).
  - Icon: right-arrow, 16px, white.
  - Hover (active): background `darken(#10A37F, 8%)`.
- Microphone button:
  - Size: **32px × 32px**.
  - Background: transparent.
  - Icon: microphone, 18px, `#858B9D`.
  - Hover: icon color `#F4F4F4`.
  - Border-radius: `radius-md`.
- Gap between send and mic buttons: `space-2` (8px).

---

## 11. Interactive States

### 11.1 Button States

| State | Background | Text/Icon | Border |
|---|---|---|---|
| Default | `#3F424A` | `#858B9D` | none |
| Hover | `#4B4F5B` | `#F4F4F4` | none |
| Active/Pressed | `#282A2E` | `#F4F4F4` | none |
| Disabled | `#282A2E` | `#4B4F5B` | none |
| Primary Default | `#10A37F` | `#F4F4F4` | none |
| Primary Hover | `#0D8F6F` | `#F4F4F4` | none |
| Primary Disabled | `#4B4F5B` | `#858B9D` | none |

### 11.2 Focus States

- All interactive elements must show a visible focus ring when keyboard-focused.
- Focus ring: `outline: 2px solid #10A37F`, `outline-offset: 2px`.
- Never remove focus outlines without replacing with an equivalent visible indicator.

### 11.3 Loading / Streaming State

- While AI is generating: show a pulsing cursor `|` inside the bubble, `color: #10A37F`.
- Stream text character-by-character or in small chunks.
- The AI avatar icon can show a subtle pulse animation (`opacity: 0.6 → 1.0`, 800ms ease-in-out infinite).
- Action buttons in the response action row are disabled (opacity 0.4) until generation completes.

### 11.4 Error State

- Error messages: `background: rgba(242, 116, 116, 0.12)`, left border `3px solid #F27474`.
- Error text: `#F27474`, 13px.
- Inline error icon: 14px, same color.

### 11.5 Delete / Destructive Confirmation

- Triggered by a destructive action (e.g., "Are you sure you want to delete this file?").
- Surface as an inline prompt within the chat list item or as a modal.
- Confirmation text: `#F27474`.
- Cancel action: standard secondary button.
- Confirm action: `background: #F27474`, text `#F4F4F4`.

---

## 12. Component Reference

### 12.1 Avatar

| Size | Diameter | Use |
|---|---|---|
| xs | 20px | Inline mention |
| sm | 28px | Message sender |
| md | 32px | Chat list item |
| lg | 40px | Profile panel |

- Always `border-radius: radius-full`.
- Fallback (no image): colored circle with initials, 13px / 600.
- AI avatar: background `#10A37F`, white brand icon inside.

### 12.2 Badge / Pill

- Padding: `space-1` (4px) vertical, `space-2` (8px) horizontal.
- Border-radius: `radius-full`.
- Font: 11px / 600 / uppercase.

| Variant | Background | Text |
|---|---|---|
| Primary | `#10A37F` | `#F4F4F4` |
| Neutral | `#3F424A` | `#858B9D` |
| Warning | `#FEC553` | `#1E1F22` |
| Error | `#F27474` | `#F4F4F4` |
| New | `#10A37F` | `#F4F4F4` |

### 12.3 Tooltip

- Background: `#4B4F5B`.
- Text: 12px / 400 / `#F4F4F4`.
- Padding: `space-1` (4px) `space-2` (8px).
- Border-radius: `radius-sm` (6px).
- Delay: 400ms before show.
- Never show tooltips on touch/mobile.

### 12.4 Divider

- Color: `#3F424A`.
- Thickness: 1px.
- Use `border-top` or `border-bottom`, not a separate `<hr>` element unless semantically appropriate.

### 12.5 Scrollbar

- Width: 4px (vertical), 4px (horizontal).
- Track background: transparent.
- Thumb background: `#4B4F5B`.
- Thumb hover: `#858B9D`.
- Border-radius: `radius-full`.
- Only show on hover of the scroll container.

### 12.6 Modal / Dialog

- Overlay: `background: rgba(0, 0, 0, 0.6)`, blur not required.
- Dialog surface: `background: #282A2E`, `border-radius: radius-xl` (16px).
- Dialog border: `1px solid #3F424A`.
- Max width: 480px for standard dialogs.
- Padding: `space-6` (24px).
- Header: 16px / 600 / `#F4F4F4`.
- Close button: top-right, 28px × 28px.

---

## 13. Iconography Rules

- Use a single consistent icon library (e.g., Lucide, Phosphor, or Heroicons — choose one and never mix).
- Icon stroke weight: **1.5px** for outlined icons.
- Icon size: always 16px, 18px, or 20px — never odd sizes.
- Icons paired with text: gap of `space-2` (8px).
- Icons used alone (icon buttons): always wrapped in a 28–40px clickable area with `border-radius: radius-md`.
- Never use colored icons except: AI avatar icon (white on green), status indicators, and explicit error/warning icons.
- Icon color follows text color of the parent context by default.

---

## 14. Do's and Don'ts

### Do

- Stack surfaces using the defined surface tokens in order (surface-0 → surface-3).
- Use `#10A37F` to indicate primary actions and AI identity only.
- Apply `radius-full` to avatars and pill-shaped elements.
- Truncate long text with ellipsis and a defined max-width.
- Show focus rings on all keyboard-interactive elements.
- Use `#858B9D` for all secondary/meta text (timestamps, previews, placeholders).
- Maintain 4px spacing grid across all margins and paddings.

### Don't

- Use emoji in interface copy, labels, or placeholder text.
- Use `#10A37F` as body text color or for decorative highlights.
- Use `accent-error` (#F27474) for anything that is not a destructive or error state.
- Add drop shadows — depth is communicated through background color contrast only.
- Introduce new colors outside the defined system.
- Use font sizes below 11px.
- Show borders between the three main columns of the app shell.
- Use `border-radius` values outside the defined radius tokens.
- Mix icon libraries or icon stroke weights.
- Place the AI avatar on the right side — it always appears on the left.
- Place the user message bubble on the left side — it always appears on the right.

---

*This document is the single source of truth for the Veso AI UI. Any deviation must be documented and justified.*
