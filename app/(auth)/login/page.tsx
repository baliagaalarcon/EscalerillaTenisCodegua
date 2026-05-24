'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Componente interno que usa useSearchParams (debe estar dentro de Suspense)
function LoginForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/ranking'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Hard redirect para que el servidor lea las cookies de Supabase correctamente
    window.location.href = redirectTo
  }

  return (
    <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          className="input"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          className="input"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
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

// Página principal — envuelve el formulario en Suspense (requerido por Next.js 14)
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
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
