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
    { href: '/desafios', label: 'Desafíos', Icon: Swords  },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', Icon: Shield }] : []),
    { href: `/perfil/${usuario?.id}`, label: 'Perfil', Icon: User },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div
        className="max-w-[480px] mx-auto px-4 pb-4 pt-2 pointer-events-auto"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div
          className="rounded-2xl border flex items-stretch p-1.5 gap-1"
          style={{
            background: 'white',
            borderColor: 'var(--line)',
            boxShadow: '0 8px 24px oklch(0.20 0.02 150 / 0.08)',
          }}
        >
          {items.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors"
                style={{
                  background: active ? 'var(--court)' : 'transparent',
                  color: active ? 'white' : 'var(--ink-2)',
                }}
              >
                <item.Icon size={16} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[13px] font-semibold leading-none">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
