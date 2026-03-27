"use client"
import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { getConversations, deleteConversation } from "@/lib/api"
import type { Conversation } from "@/lib/types"

interface Props {
  isOpen?: boolean
  onClose?: () => void
}

export function ChatListPanel({ isOpen, onClose }: Props) {
  const { data: session } = useSession()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [search, setSearch] = useState("")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const load = useCallback(() => {
    if (session) getConversations(session).then(setConvs)
  }, [session])

  useEffect(() => { load() }, [load])
  useEffect(() => { load() }, [pathname, load])

  const filtered = convs.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (e: React.MouseEvent, convId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return
    await deleteConversation(convId, session)
    setConvs(prev => prev.filter(c => c.id !== convId))
    if (pathname === `/chat/${convId}`) router.push("/chat")
  }

  const handleNavClick = () => onClose?.()

  return (
    <div
      className={[
        // Always fixed — no position switching
        "fixed inset-y-0 left-14 w-64 z-30",
        "flex flex-col bg-surface-1 border-r border-surface-2/50",
        "transition-transform duration-200 ease-in-out",
        // Desktop: always show. Mobile: show only when isOpen
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] flex-shrink-0 border-b border-surface-2/50">
        <span className="text-neutral font-semibold text-base">My Chats</span>
        <button
          onClick={() => { router.push("/chat"); handleNavClick() }}
          title="New chat"
          className="w-7 h-7 flex items-center justify-center bg-surface-2 hover:bg-surface-3 rounded-md transition-colors"
        >
          <Plus size={15} className="text-neutral" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 bg-surface-2 rounded-full px-3 h-8">
          <Search size={13} className="text-surface-4 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-sm text-neutral placeholder:text-surface-4 outline-none w-full"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <p className="text-surface-4 text-xs text-center mt-8 px-4">
            {search ? "No matching chats" : "No chats yet. Start a conversation."}
          </p>
        )}
        {filtered.map(conv => {
          const active = pathname === `/chat/${conv.id}`
          return (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              onClick={handleNavClick}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={[
                "flex items-center gap-2 px-3 py-2.5 rounded-lg mb-0.5 transition-colors group",
                active ? "bg-surface-2" : "hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-neutral block truncate">{conv.title}</span>
                <span className="text-[11px] text-surface-4 block mt-0.5">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </span>
              </div>
              {hoveredId === conv.id && (
                <button
                  onClick={e => handleDelete(e, conv.id)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-accent-error/20 transition-colors"
                  title="Delete conversation"
                >
                  <Trash2 size={13} className="text-surface-4 hover:text-accent-error" />
                </button>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
