'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavBarProps {
  usuario: { id: string; nombre: string; rol: string } | null
}

const NAV_ITEMS = [
  { href: '/ranking',       label: 'Ranking',      icon: '🏆' },
  { href: '/desafios',      label: 'Desafíos',     icon: '⚔️' },
  { href: '/notificaciones',label: 'Avisos',       icon: '🔔' },
]

export default function NavBar({ usuario }: NavBarProps) {
  const pathname = usePathname()
  const isAdmin = usuario?.rol === 'directiva' || usuario?.rol === 'admin'

  const items = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: '⚙️' }] : []),
    { href: `/perfil/${usuario?.id}`, label: 'Perfil', icon: '👤' },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40
                    flex items-center justify-around px-2 h-16 safe-area-pb">
      {items.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
                        text-xs transition-colors min-w-0
                        ${active
                          ? 'text-sky-600 font-semibold'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
