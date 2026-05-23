import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Rutas que requieren autenticación
const PROTECTED_ROUTES = ['/ranking', '/desafios', '/perfil', '/notificaciones']
// Rutas que requieren rol directiva o admin
const ADMIN_ROUTES = ['/admin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtener sesión activa
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Rutas de auth: si ya está logueado, redirigir al ranking
  if (pathname.startsWith('/login') || pathname.startsWith('/registro')) {
    if (user) {
      return NextResponse.redirect(new URL('/ranking', request.url))
    }
    return supabaseResponse
  }

  // Rutas protegidas: si no está logueado, redirigir a login
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAdmin = ADMIN_ROUTES.some(r => pathname.startsWith(r))

  if ((isProtected || isAdmin) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rutas de admin: verificar rol en la base de datos
  if (isAdmin && user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('auth_id', user.id)
      .single()

    if (!usuario || !['directiva', 'admin'].includes(usuario.rol)) {
      return NextResponse.redirect(new URL('/ranking', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
