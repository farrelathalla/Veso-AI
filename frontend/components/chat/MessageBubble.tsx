"use client"
import { useState } from "react"
import { Copy, Check, BookOpen, FileText } from "lucide-react"
import Link from "next/link"
import type { Message } from "@/lib/types"

interface Props {
  message: Message
  isStreaming?: boolean
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_{3,})/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="font-semibold text-neutral">{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="bg-surface-0 px-1 py-0.5 rounded text-xs font-mono text-brand-primary">{part.slice(1, -1)}</code>
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>
    if (/^_{3,}$/.test(part))
      return <span key={i} className="inline-block min-w-[80px] border-b border-brand-primary/60 mx-0.5 align-bottom" />
    return part
  })
}

function parseTableRow(line: string): string[] {
  return line.split("|").slice(1, -1).map(cell => cell.trim())
}

function renderTable(lines: string[], startKey: number): React.ReactNode {
  const headers = parseTableRow(lines[0])
  // lines[1] is the separator row (---|---|...), skip it
  const rows = lines.slice(2).map(l => parseTableRow(l))
  return (
    <div key={startKey} className="my-2 overflow-x-auto rounded-lg border border-surface-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface-2">
            {headers.map((h, ci) => (
              <th key={ci} className="px-3 py-2 text-left text-xs font-semibold text-neutral border-b border-surface-3">
                {inlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-surface-1" : "bg-surface-2/40"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-neutral border-b border-surface-3/50 last:border-b-0 leading-relaxed">
                  {inlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function cleanChatText(text: string): string {
  // Unwrap Anki cloze syntax: {{c1::answer}} → answer
  text = text.replace(/\{\{c\d+::([^}]*)\}\}/g, "$1")
  // Drop any remaining broken {{...}} markers
  text = text.replace(/\{\{[^}]*\}\}/g, "")
  // Drop § section markers
  text = text.replace(/§\s*\d*/g, "")
  // Drop LLM Anki workflow suggestion lines (e.g. "Need cards? Ask 'make Anki cards from §1'...")
  text = text
    .split("\n")
    .filter(line => !/need cards\? ask/i.test(line) && !/make anki cards from/i.test(line) && !/batch.?generate/i.test(line))
    .join("\n")
  // Collapse runs of spaces introduced by removals
  text = text.replace(/[ \t]{2,}/g, " ")
  return text
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={`code-${i}`} className="bg-surface-0 rounded-lg px-4 py-3 my-2 overflow-x-auto text-xs font-mono text-neutral leading-relaxed">
          <code>{codeLines.join("\n")}</code>
        </pre>
      )
      i++
      continue
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(<p key={i} className="font-semibold text-neutral mt-3 mb-0.5 text-sm">{inlineMarkdown(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-semibold text-neutral mt-3 mb-0.5">{inlineMarkdown(line.slice(3))}</p>)
      i++; continue
    }
    if (line.startsWith("# ")) {
      elements.push(<p key={i} className="font-semibold text-neutral mt-3 mb-0.5">{inlineMarkdown(line.slice(2))}</p>)
      i++; continue
    }

    // Bullet list (-, *, •, or indented with spaces)
    if (/^(\s{0,3}[-*•]|\s{2,3}\S)/.test(line) && line.match(/^[\s]*[-*•]\s/)) {
      const content = line.replace(/^[\s]*[-*•]\s/, "")
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0
      elements.push(
        <div key={i} className="flex gap-2" style={{ paddingLeft: `${indent * 4 + 8}px` }}>
          <span className="text-surface-4 flex-shrink-0 mt-0.5">•</span>
          <span className="leading-[1.7]">{inlineMarkdown(content)}</span>
        </div>
      )
      i++; continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1]
      const content = line.replace(/^\d+\.\s/, "")
      elements.push(
        <div key={i} className="flex gap-2 pl-2">
          <span className="text-surface-4 flex-shrink-0 tabular-nums">{num}.</span>
          <span className="leading-[1.7]">{inlineMarkdown(content)}</span>
        </div>
      )
      i++; continue
    }

    // Table — collect all | lines including separator
    if (line.startsWith("|")) {
      const tableStartKey = i
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i])
        i++
      }
      if (tableLines.length >= 2) {
        elements.push(renderTable(tableLines, tableStartKey))
      }
      continue
    }

    // Empty line → small gap
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />)
      i++; continue
    }

    // Regular text
    elements.push(
      <p key={i} className="leading-[1.7]">{inlineMarkdown(line)}</p>
    )
    i++
  }

  return elements
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Anki deck result card
  if (message.ankiDeck) {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-brand-primary flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-1">
          V
        </div>
        <div className="max-w-[75%]">
          <Link
            href="/anki"
            className="block p-4 bg-surface-2 rounded-xl border border-brand-primary/20 hover:border-brand-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen size={16} className="text-brand-primary" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral group-hover:text-brand-primary transition-colors truncate">
                  {message.ankiDeck.title}
                </div>
                <div className="text-[11px] text-surface-4">
                  {message.ankiDeck.card_count} cards generated
                </div>
              </div>
            </div>
            <div className="text-[12px] text-surface-4 group-hover:text-neutral transition-colors">
              Tap to view your Anki deck
            </div>
          </Link>
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[65%]">
          {message.attachedFile && (
            <div className="flex items-center justify-end mb-1.5">
              <span className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary font-medium max-w-full truncate">
                <FileText size={10} className="flex-shrink-0" />
                {message.attachedFile}
              </span>
            </div>
          )}
          <div className="bg-surface-2 rounded-xl rounded-br-sm px-4 py-3 text-sm text-neutral leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="text-[11px] text-surface-4 text-right mt-1">You</div>
        </div>
        <div className="w-7 h-7 rounded-full bg-surface-3 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-neutral mt-1">
          U
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {/* AI avatar */}
      <div className="w-7 h-7 rounded-full bg-brand-primary flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-1">
        V
      </div>

      <div className="max-w-[75%] flex flex-col gap-1.5">
        {/* Bubble */}
        <div className="bg-surface-2 rounded-xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral">Veso AI</span>
            {!isStreaming && message.content && (
              <span className="text-[11px] text-surface-4">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="text-sm text-neutral">
            {isStreaming && !message.content ? (
              <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse align-middle" />
            ) : (
              <>
                {renderMarkdown(cleanChatText(message.content))}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse ml-0.5 align-middle" />
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isStreaming && message.content && (
          <div className="flex justify-end">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded-md text-[12px] text-surface-4 hover:text-neutral transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
