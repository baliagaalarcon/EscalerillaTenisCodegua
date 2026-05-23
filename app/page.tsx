// Página raíz: redirige al ranking si está logueado, sino a login
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/ranking')
  } else {
    redirect('/login')
  }
}
