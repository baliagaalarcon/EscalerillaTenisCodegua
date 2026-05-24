'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Form POST nativo al Route Handler — el browser recibe las cookies + redirect
// en una sola respuesta HTTP, garantizando que el middleware las reconoce.
function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/ranking'
  const hasError = searchParams.get('error') === 'credentials'
  const [loading, setLoading] = useState(false)

  return (
    <form
      method="POST"
      action="/api/auth/login"
      onSubmit={() => setLoading(true)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
    >
      {/* redirectTo viaja como campo oculto */}
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          name="email"
          className="input"
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          name="password"
          className="input"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      {hasError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          Email o contraseña incorrectos
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <div className="text-center">
        <Link href="/forgot-password" className="text-sm text-sky-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Club Tenis Codegua</h1>
          <p className="text-gray-500 text-sm mt-1">Escalerilla 2025</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">Cargando...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿No tienes cuenta? Contacta a la directiva del club.
        </p>
      </div>
    </div>
  )
}
