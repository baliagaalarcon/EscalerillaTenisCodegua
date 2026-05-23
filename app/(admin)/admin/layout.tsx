// Layout del panel de administración
// El middleware ya verificó que el usuario tiene rol directiva/admin
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const NAV_ITEMS = [
  { href: '/admin',               label: 'Dashboard',   icon: '📊' },
  { href: '/admin/desafios',      label: 'Desafíos',    icon: '⚔️' },
  { href: '/admin/jugadores',     label: 'Jugadores',   icon: '👥' },
  { href: '/admin/sanciones',     label: 'Sanciones',   icon: '🚫' },
  { href: '/admin/ranking',       label: 'Ranking',     icon: '🏆' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, apellido')
    .eq('auth_id', user!.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 fixed inset-y-0">
        <div className="p-5 border-b border-gray-100">
          <p className="font-bold text-gray-900">🎾 Codegua</p>
          <p className="text-xs text-gray-400 mt-0.5">Panel Directiva</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700
                         hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">{usuario?.nombre} {usuario?.apellido}</p>
          <Link href="/ranking" className="text-xs text-sky-500 hover:underline mt-0.5 block">
            ← Volver al ranking
          </Link>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 md:ml-56 p-6">
        {children}
      </main>
    </div>
  )
}
