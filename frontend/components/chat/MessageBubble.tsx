"use client"
import { useState } from "react"
import { Copy, Check, BookOpen, FileText } from "lucide-react"
import Link from "next/link"
import { Streamdown } from "streamdown"
import type { Message } from "@/lib/types"

interface Props {
  message: Message
  isStreaming?: boolean
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
  // Strip em-dash / en-dash horizontal rule lines produced by the LLM (e.g. "–––––––––")
  text = text.replace(/^[\u2013\u2014\-]{3,}\s*$/gm, "")
  // Collapse runs of spaces introduced by removals
  text = text.replace(/[ \t]{2,}/g, " ")
  return text
}

const CHAT_MD_COMPONENTS = {
  p: ({ children }: any) => <p className="leading-[1.7]">{children}</p>,
  h1: ({ children }: any) => <p className="font-semibold text-neutral mt-3 mb-0.5">{children}</p>,
  h2: ({ children }: any) => <p className="font-semibold text-neutral mt-3 mb-0.5">{children}</p>,
  h3: ({ children }: any) => <p className="font-semibold text-neutral mt-3 mb-0.5 text-sm">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-neutral">{children}</strong>,
  em: ({ children }: any) => <em>{children}</em>,
  code: ({ children, className }: any) => {
    if (className?.startsWith("language-")) {
      return <code className="text-xs font-mono text-neutral leading-relaxed">{children}</code>
    }
    return <code className="bg-surface-0 px-1 py-0.5 rounded text-xs font-mono text-brand-primary">{children}</code>
  },
  pre: ({ children }: any) => (
    <pre className="bg-surface-0 rounded-lg px-4 py-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">{children}</pre>
  ),
  ul: ({ children }: any) => <div className="flex flex-col gap-0.5 pl-2">{children}</div>,
  ol: ({ children }: any) => <div className="flex flex-col gap-0.5 pl-2">{children}</div>,
  li: ({ children }: any) => (
    <div className="flex gap-2">
      <span className="text-surface-4 flex-shrink-0 mt-0.5">•</span>
      <span className="leading-[1.7]">{children}</span>
    </div>
  ),
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">
      {children}
    </a>
  ),
  table: ({ children }: any) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-surface-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral border-b border-surface-3 bg-surface-2">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="px-3 py-2 text-neutral border-b border-surface-3/50 leading-relaxed">{children}</td>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-brand-primary/40 pl-3 my-1 text-surface-4 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-surface-3 my-3" />,
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
            {message.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-surface-4">
                <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Creating Anki cards...
              </div>
            ) : isStreaming && !message.content ? (
              <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse align-middle" />
            ) : (
              <>
                <Streamdown mode={isStreaming ? "streaming" : "static"} components={CHAT_MD_COMPONENTS}>
                  {cleanChatText(message.content)}
                </Streamdown>
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

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-1">
            <div className="text-[11px] text-surface-4 mb-1.5 font-medium">Sources</div>
            <div className="flex flex-col gap-1">
              {message.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-[11px] text-brand-primary hover:text-brand-primary/80 transition-colors leading-relaxed"
                >
                  <span className="flex-shrink-0 mt-0.5 text-surface-4">{i + 1}.</span>
                  <span className="truncate">{source.title || source.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
