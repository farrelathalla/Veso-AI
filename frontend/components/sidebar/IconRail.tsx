"use client"
import { MessageSquare, BookOpen, Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"

const navItems = [
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/anki", icon: BookOpen, label: "Anki Cards" },
]

interface Props {
  onMenuClick?: () => void
}

export function IconRail({ onMenuClick }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const initial = session?.user?.name?.[0]?.toUpperCase() ?? "U"

  return (
    <aside className="relative z-40 w-14 flex-shrink-0 bg-surface-0 flex flex-col items-center py-3 gap-1.5">
      {/* Logo */}
      <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center mb-2 flex-shrink-0">
        <span className="text-white font-bold text-base select-none">V</span>
      </div>

      {/* Mobile hamburger — opens chat list panel */}
      <button
        onClick={onMenuClick}
        title="Toggle sidebar"
        className="w-10 h-10 flex items-center justify-center rounded-md text-surface-4 hover:text-neutral hover:bg-white/5 transition-colors mb-2 md:hidden"
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>

      {/* Nav items */}
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={[
              "relative w-10 h-10 flex items-center justify-center rounded-md transition-colors",
              active
                ? "text-brand-primary"
                : "text-surface-4 hover:text-neutral hover:bg-white/5",
            ].join(" ")}
          >
            {active && (
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-primary rounded-full" />
            )}
            <Icon size={20} strokeWidth={1.5} />
          </Link>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar / sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        title="Sign out"
        className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-brand-primary transition-colors flex-shrink-0 flex items-center justify-center bg-surface-2 text-xs font-semibold text-neutral"
      >
        {session?.user?.image ? (
          <img src={session.user.image} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>
    </aside>
  )
}
