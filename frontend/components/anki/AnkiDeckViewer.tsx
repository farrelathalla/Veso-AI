"use client"
import { useState } from "react"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { AnkiCard } from "./AnkiCard"
import type { AnkiCard as AnkiCardType } from "@/lib/types"

interface Props {
  cards: AnkiCardType[]
  deckTitle: string
  onClose: () => void
}

export function AnkiDeckViewer({ cards, deckTitle, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [key, setKey] = useState(0) // force remount of AnkiCard to reset flip

  const goTo = (next: number) => {
    setIndex(next)
    setKey(k => k + 1) // reset flip state on navigation
  }

  const card = cards[index]
  if (!card) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-[52px] border-b border-surface-2/50 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-surface-4 hover:text-neutral transition-colors"
          title="Back to decks"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <h2 className="text-neutral font-semibold flex-1 truncate text-sm">{deckTitle}</h2>
        <span className="text-surface-4 text-sm">{cards.length} cards</span>
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 overflow-hidden">
        <AnkiCard key={key} card={card} total={cards.length} current={index + 1} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-surface-2/50 flex-shrink-0">
        <button
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          className="w-10 h-10 flex items-center justify-center bg-surface-2 hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          <ChevronLeft size={18} className="text-neutral" strokeWidth={1.5} />
        </button>

        <span className="text-surface-4 text-sm w-28 text-center tabular-nums">
          {index + 1} of {cards.length}
        </span>

        <button
          onClick={() => goTo(Math.min(cards.length - 1, index + 1))}
          disabled={index === cards.length - 1}
          className="w-10 h-10 flex items-center justify-center bg-surface-2 hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          <ChevronRight size={18} className="text-neutral" strokeWidth={1.5} />
        </button>

        <button
          onClick={() => goTo(0)}
          title="Restart from first card"
          className="w-10 h-10 flex items-center justify-center bg-surface-2 hover:bg-surface-3 rounded-md transition-colors ml-2"
        >
          <RotateCcw size={15} className="text-surface-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
