// Perfil público de un jugador: info, posición actual e historial
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatearResultado, iconoTendencia } from '@/lib/utils/ranking'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuarios')
    .select('nombre, apellido')
    .eq('id', params.id)
    .single()
  return { title: data ? `${data.nombre} ${data.apellido} — Codegua` : 'Perfil' }
}

export default async function PerfilPage({ params }: Props) {
  const supabase = await createClient()

  // Datos del jugador
  const { data: jugador, error } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, foto_url, telefono, estado, cuotas_al_dia')
    .eq('id', params.id)
    .single()

  if (error || !jugador) notFound()

  // Posición actual
  const { data: temporada } = await supabase
    .from('temporadas')
    .select('id, nombre')
    .eq('estado', 'activa')
    .single()

  const { data: posicion } = await supabase
    .from('v_ranking_actual')
    .select('posicion, tendencia, grupo_nombre, grupo_color, tiene_desafio_activo')
    .eq('usuario_id', params.id)
    .eq('temporada_id', temporada?.id ?? 0)
    .single()

  // Historial de partidos
  const { data: historial } = await supabase
    .from('v_historial_partidos')
    .select('*')
    .or(`ganador_id.eq.${params.id},perdedor_id.eq.${params.id}`)
    .eq('temporada_id', temporada?.id ?? 0)
    .order('fecha_jugado', { ascending: false })
    .limit(20)

  const victorias = historial?.filter(p => p.ganador_id === params.id).length ?? 0
  const derrotas  = historial?.filter(p => p.perdedor_id === params.id).length ?? 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header del perfil */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex gap-5 items-center">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center
                        text-2xl font-bold text-gray-500 shrink-0 overflow-hidden">
          {jugador.foto_url ? (
            <img src={jugador.foto_url} alt={jugador.nombre} className="w-full h-full object-cover" />
          ) : (
            `${jugador.nombre[0]}${jugador.apellido[0]}`
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">
            {jugador.nombre} {jugador.apellido}
          </h1>

          {posicion && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: posicion.grupo_color }}
              />
              <span className="text-sm text-gray-600">
                Posición <strong>#{posicion.posicion}</strong> · {posicion.grupo_nombre}
              </span>
              <span className="text-sm font-medium" title="Tendencia">
                {iconoTendencia(posicion.tendencia as any)}
              </span>
            </div>
          )}

          {posicion?.tiene_desafio_activo && (
            <span className="badge bg-blue-100 text-blue-700 mt-2">
              ⚔️ Con desafío activo
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Victorias', valor: victorias, color: 'text-green-600' },
          { label: 'Derrotas',  valor: derrotas,  color: 'text-red-600' },
          { label: 'Partidos',  valor: victorias + derrotas, color: 'text-gray-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.valor}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historial de partidos */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Historial de Partidos
        </h2>
        {!historial?.length ? (
          <p className="text-gray-400 text-sm">Sin partidos registrados esta temporada.</p>
        ) : (
          <div className="space-y-2">
            {historial.map(p => {
              const gano = p.ganador_id === params.id
              const rival = gano
                ? `${p.nombre_perdedor} ${p.apellido_perdedor}`
                : `${p.nombre_ganador} ${p.apellido_ganador}`
              const resultado = formatearResultado(
                p.set1_ganador, p.set1_perdedor,
                p.set2_ganador, p.set2_perdedor,
                p.stb_ganador, p.stb_perdedor
              )

              return (
                <div
                  key={p.partido_id}
                  className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3"
                >
                  <span className={`text-lg ${gano ? '' : 'opacity-40'}`}>
                    {p.es_wo ? '🚫' : gano ? '🏆' : '😔'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {gano ? 'Victoria' : 'Derrota'} vs {rival}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.es_wo ? 'W.O.' : resultado}
                      {p.fecha_jugado && (
                        <span> · {new Date(p.fecha_jugado).toLocaleDateString('es-CL')}</span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
