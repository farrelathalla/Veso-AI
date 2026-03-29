export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  created_at?: string
  ankiDeck?: { id: string; title: string; card_count: number }
  attachedFile?: string
  sources?: { title: string; url: string }[]
  isLoading?: boolean
}

export interface AnkiCard {
  id: string
  front: string
  back: string
  difficulty: "easy" | "medium" | "hard"
  card_type: "concept" | "conceptual" | "clinical"
  position: number
}

export interface AnkiDeck {
  id: string
  title: string
  topic: string
  card_count: number
  created_at: string
}
