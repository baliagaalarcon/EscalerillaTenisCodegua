// Layout principal de la app (autenticado)
// Muestra la barra de navegación inferior (mobile-first)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavBar from '@/components/layout/NavBar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Obtener datos del usuario actual para pasarlos al NavBar
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, foto_url, rol')
    .eq('auth_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Contenido principal */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Navegación inferior (mobile) */}
      <NavBar usuario={usuario} />
    </div>
  )
}
