// Login via Route Handler: el método más confiable para Supabase SSR.
// El cliente crea el supabase server client, setea las cookies en la respuesta HTTP
// directamente, y hace redirect. El browser recibe las cookies en el mismo redirect
// y las envía al middleware en la siguiente request.
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/ranking'

  // 303 See Other: convierte POST → GET en el redirect (evita HTTP 405)
  const successResponse = NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Seteamos las cookies directamente en el objeto de redirect response
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const errorUrl = new URL('/login', request.url)
    errorUrl.searchParams.set('error', 'credentials')
    if (redirectTo !== '/ranking') {
      errorUrl.searchParams.set('redirectTo', redirectTo)
    }
    return NextResponse.redirect(errorUrl, { status: 303 })
  }

  return successResponse
}
