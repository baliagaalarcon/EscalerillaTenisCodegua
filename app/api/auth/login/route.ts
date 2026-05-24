// Route Handler para login — usa el cliente servidor para que las cookies
// queden correctamente seteadas antes de que el browser navegue al ranking
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json(
      { error: 'Email o contraseña incorrectos' },
      { status: 401 }
    )
  }

  return NextResponse.json({ ok: true })
}
