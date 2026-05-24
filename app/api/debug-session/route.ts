// TEMPORAL — endpoint de debug para diagnosticar cookies y sesión
// Borrar después de solucionar el problema de login
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'))

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    user: user ? { email: user.email, id: user.id } : null,
    error: error?.message ?? null,
    supabaseCookieCount: supabaseCookies.length,
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    allCookieCount: allCookies.length,
  })
}
