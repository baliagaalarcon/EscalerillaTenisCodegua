'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, Swords, User, Shield } from 'lucide-react'

interface NavBarProps {
  usuario: { id: string; nombre: string; rol: string } | null
}

export default function NavBar({ usuario }: NavBarProps) {
  const pathname = usePathname()
  const isAdmin = usuario?.rol === 'directiva' || usuario?.rol === 'admin'

  const items = [
    { href: '/ranking',  label: 'Ranking',  Icon: Trophy  },
    { href: '/desafios', label: 'Desafios', Icon: Swords  },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', Icon: Shield }] : []),
    { href: `/perfil/${usuario?.id}`, label: 'Perfil', Icon: User },
  ]

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 h-16"
      style={{ background: 'white', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(item => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-0 transition-colors"
            style={{ color: active ? 'var(--court)' : 'var(--ink-3)' }}
          >
            <item.Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span
              className="text-[10px] font-mono uppercase tracking-[0.12em] truncate"
              style={{ fontWeight: active ? 700 : 500 }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
