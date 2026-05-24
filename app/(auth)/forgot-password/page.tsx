'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError('No se pudo enviar el email. Verifica que el correo sea correcto.')
      setLoading(false)
      return
    }

    setSent(true)
  }

  // Pantalla de confirmación
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📬</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Revisa tu correo</h1>
          <p className="text-gray-500 text-sm">
            Enviamos un link de recuperación a{' '}
            <span className="font-medium text-gray-700">{email}</span>.
            Puede tardar unos minutos.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Revisa también la carpeta de spam.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm text-sky-600 hover:underline"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Te enviamos un link por email</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link de recuperación'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          <Link href="/login" className="text-sky-600 hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </p>

      </div>
    </div>
  )
}
