// Login via Route Handler con la API correcta de @supabase/ssr v0.3.x (get/set/remove)
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/ranking'

  // 303 convierte POST → GET en el redirect
  const successResponse = NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Setear directamente en el redirect response
          successResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          successResponse.cookies.set({ name, value: '', ...options })
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
