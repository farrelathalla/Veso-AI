"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import type { AnkiCard as AnkiCardType } from "@/lib/types"

const DIFFICULTY: Record<string, { label: string; cls: string }> = {
  easy:   { label: "Easy",   cls: "bg-brand-primary/10 text-brand-primary border-brand-primary/20" },
  medium: { label: "Medium", cls: "bg-accent-warning/10 text-accent-warning border-accent-warning/20" },
  hard:   { label: "Hard",   cls: "bg-accent-error/10 text-accent-error border-accent-error/20" },
}

const TYPE: Record<string, string> = {
  concept:     "Concept",
  conceptual:  "Conceptual",
  clinical:    "Clinical",
}

interface Props {
  card: AnkiCardType
  total: number
  current: number
}

export function AnkiCard({ card, total, current }: Props) {
  const [flipped, setFlipped] = useState(false)
  const diff = DIFFICULTY[card.difficulty] ?? DIFFICULTY.medium

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-[11px] text-surface-4 font-medium tabular-nums w-12 text-right">
          {current}/{total}
        </span>
        <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary rounded-full transition-all duration-300"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${diff.cls}`}>
            {diff.label}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-surface-2 text-surface-4">
            {TYPE[card.card_type] ?? card.card_type}
          </span>
        </div>
      </div>

      {/* Flip card */}
      <div
        className="w-full cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped(f => !f)}
      >
        <motion.div
          style={{ transformStyle: "preserve-3d", position: "relative" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="h-64"
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 bg-surface-2 rounded-xl border border-surface-3 flex flex-col items-center justify-center px-8 py-6"
          >
            <span className="text-[11px] text-surface-4 font-medium uppercase tracking-widest mb-5">
              Question
            </span>
            <p className="text-neutral text-base font-medium text-center leading-relaxed">
              {card.front}
            </p>
            <span className="mt-6 text-[11px] text-surface-4">Click to reveal answer</span>
          </div>

          {/* Back */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 bg-surface-2 rounded-xl border border-brand-primary/30 flex flex-col items-center justify-center px-8 py-6"
          >
            <span className="text-[11px] text-brand-primary font-medium uppercase tracking-widest mb-5">
              Answer
            </span>
            <p className="text-neutral text-sm text-center leading-relaxed">
              {card.back}
            </p>
          </div>
        </motion.div>
      </div>

      <p className="text-[11px] text-surface-4">Click card to flip</p>
    </div>
  )
}
