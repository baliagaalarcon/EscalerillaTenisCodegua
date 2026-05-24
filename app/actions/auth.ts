'use server'

import { createClient } from '@/lib/supabase/server'

export async function loginAction(email: string, password: string, redirectTo: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email o contraseña incorrectos' }
  }

  // Retornamos ok — el cliente hace window.location.href para cambiar el layout completo
  return { ok: true }
}
