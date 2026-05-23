// Lista de desafíos del usuario actual (activos + histórico)
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { labelEstadoDesafio, colorEstadoDesafio } from '@/lib/utils/ranking'

export const metadata = { title: 'Mis Desafíos — Escalerilla Codegua' }

export default async function DesafiosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  const usuarioId = usuario?.id ?? ''

  // Obtener desafíos donde participa el usuario (como desafiante o desafiado)
  const { data: desafios } = await supabase
    .from('desafios')
    .select(`
      id, estado, fecha_desafio, fecha_partido_acordada,
      posicion_desafiante_snapshot, posicion_desafiado_snapshot,
      desafiante:desafiante_id ( id, nombre, apellido, foto_url ),
      desafiado:desafiado_id   ( id, nombre, apellido, foto_url )
    `)
    .or(`desafiante_id.eq.${usuarioId},desafiado_id.eq.${usuarioId}`)
    .order('fecha_desafio', { ascending: false })
    .limit(30)

  const activos = desafios?.filter(d =>
    !['jugado','cancelado_mutuo','wo_desafiante','wo_desafiado','nulo'].includes(d.estado)
  ) ?? []
  const historico = desafios?.filter(d =>
    ['jugado','cancelado_mutuo','wo_desafiante','wo_desafiado','nulo'].includes(d.estado)
  ) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Desafíos</h1>
        <Link href="/desafios/nuevo" className="btn-primary text-sm">
          + Nuevo desafío
        </Link>
      </div>

      {/* Desafíos activos */}
      {activos.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            En curso
          </h2>
          <div className="space-y-3">
            {activos.map(d => (
              <DesafioCard
                key={d.id}
                desafio={d as any}
                usuarioId={usuarioId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Historial */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Historial
        </h2>
        {historico.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay desafíos anteriores.</p>
        ) : (
          <div className="space-y-2">
            {historico.map(d => (
              <DesafioCard
                key={d.id}
                desafio={d as any}
                usuarioId={usuarioId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// Componente inline para la tarjeta de desafío
function DesafioCard({ desafio, usuarioId }: { desafio: any; usuarioId: string }) {
  const esDesafiante = desafio.desafiante?.id === usuarioId
  const rival = esDesafiante ? desafio.desafiado : desafio.desafiante
  const miPosicion = esDesafiante
    ? desafio.posicion_desafiante_snapshot
    : desafio.posicion_desafiado_snapshot
  const rivalPosicion = esDesafiante
    ? desafio.posicion_desafiado_snapshot
    : desafio.posicion_desafiante_snapshot

  return (
    <Link
      href={`/desafios/${desafio.id}`}
      className="block bg-white rounded-xl border border-gray-100 px-4 py-3
                 hover:border-sky-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar rival */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
            {rival?.foto_url ? (
              <img src={rival.foto_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              `${rival?.nombre?.[0]}${rival?.apellido?.[0]}`
            )}
          </div>

          <div>
            <p className="font-medium text-gray-900 text-sm">
              {esDesafiante ? '⚔️ Desafié a' : '🛡 Me desafió'}
              {' '}<span>{rival?.nombre} {rival?.apellido}</span>
            </p>
            <p className="text-xs text-gray-400">
              Pos. {miPosicion} vs {rivalPosicion}
            </p>
          </div>
        </div>

        <span className={`badge ${colorEstadoDesafio(desafio.estado)}`}>
          {labelEstadoDesafio(desafio.estado)}
        </span>
      </div>
    </Link>
  )
}
