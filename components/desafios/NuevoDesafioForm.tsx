'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RankingJugador {
  usuario_id: string
  posicion: number
  nombre: string
  apellido: string
  foto_url: string | null
  grupo_nombre: string
  grupo_color: string
  cuotas_al_dia: boolean
}

interface Props {
  desafianteId: string
  temporadaId: number
  jugadoresElegibles: RankingJugador[]
  habilitado: boolean
}

export default function NuevoDesafioForm({
  desafianteId,
  temporadaId,
  jugadoresElegibles,
  habilitado,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [desafiadoId, setDesafiadoId] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!desafiadoId) return
    setLoading(true)
    setError(null)

    const { data: validacion } = await supabase.rpc('fn_puede_desafiar', {
      p_desafiante_id: desafianteId,
      p_desafiado_id:  desafiadoId,
      p_temporada_id:  temporadaId,
    })

    if (!validacion?.[0]?.puede) {
      setError(validacion?.[0]?.razon ?? 'No puedes realizar este desafío')
      setLoading(false)
      return
    }

    const desafiado = jugadoresElegibles.find(j => j.usuario_id === desafiadoId)

    const { error: insertError } = await supabase.from('desafios').insert({
      temporada_id:                   temporadaId,
      desafiante_id:                  desafianteId,
      desafiado_id:                   desafiadoId,
      posicion_desafiante_snapshot:   0,
      posicion_desafiado_snapshot:    desafiado?.posicion ?? 0,
      estado:                         'pendiente_registro',
      fecha_desafio:                  new Date().toISOString(),
      fecha_limite_registro:          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notas: notas || null,
    })

    if (insertError) {
      setError('Error al crear el desafío. Intenta nuevamente.')
      setLoading(false)
      return
    }

    router.push('/desafios')
    router.refresh()
  }

  if (!habilitado) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-500 text-sm">
          No puedes crear un desafío en este momento.<br/>
          Puede que tengas uno activo o tu cuenta no esté habilitada.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecciona a quién desafiar
        </label>

        {jugadoresElegibles.length === 0 ? (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
            No hay jugadores disponibles para desafiar en este momento.
            Todos los jugadores de tu grupo y el grupo superior tienen desafíos activos.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200">
            {jugadoresElegibles.map(j => (
              <label
                key={j.usuario_id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${desafiadoId === j.usuario_id ? 'bg-sky-50 border-l-4 border-sky-400' : ''}`}
              >
                <input
                  type="radio"
                  name="desafiado"
                  value={j.usuario_id}
                  checked={desafiadoId === j.usuario_id}
                  onChange={e => setDesafiadoId(e.target.value)}
                  className="text-sky-500"
                />
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: j.grupo_color }}
                >
                  {j.posicion}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {j.nombre} {j.apellido}
                  </p>
                  <p className="text-xs text-gray-400">{j.grupo_nombre}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas (opcional)
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Mensaje para el rival o la comisión..."
          value={notas}
          onChange={e => setNotas(e.target.value)}
        />
      </div>

      <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
        <p>⏱ Tienes <strong>24 horas</strong> para notificar a la comisión (regla 10)</p>
        <p>📅 El partido debe jugarse en un máximo de <strong>5 días</strong> (regla 6/7)</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={loading || !desafiadoId || jugadoresElegibles.length === 0}
      >
        {loading ? 'Creando desafío...' : 'Crear desafío'}
      </button>
    </form>
  )
}
