import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavBar from '@/components/layout/NavBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, foto_url, rol')
    .eq('auth_id', user.id)
    .single()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper-2)' }}>
      <main className="flex-1 pb-20">{children}</main>
      <NavBar usuario={usuario} />
    </div>
  )
}
