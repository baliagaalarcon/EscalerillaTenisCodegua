// Dashboard de administración: resumen del estado actual
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Admin — Escalerilla Codegua' }

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: temporada } = await supabase
    .from('temporadas')
    .select('id, nombre, fecha_fin')
    .eq('estado', 'activa')
    .single()

  const temporadaId = temporada?.id ?? 0

  // Estadísticas en paralelo
  const [
    { count: totalJugadores },
    { count: desafiosActivos },
    { count: partidosPendientes },
    { count: sancionesPendientes },
  ] = await Promise.all([
    supabase.from('ranking').select('*', { count: 'exact', head: true }).eq('temporada_id', temporadaId),
    supabase.from('desafios').select('*', { count: 'exact', head: true })
      .eq('temporada_id', temporadaId)
      .in('estado', ['activo', 'horario_propuesto', 'confirmado', 'pendiente_registro']),
    supabase.from('partidos').select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente_confirmacion'),
    supabase.from('sanciones').select('*', { count: 'exact', head: true })
      .eq('aplicada', false),
  ])

  // Últimos desafíos pendientes de registro (24 hrs)
  const { data: pendientesRegistro } = await supabase
    .from('desafios')
    .select(`
      id, fecha_desafio, fecha_limite_registro,
      desafiante:desafiante_id ( nombre, apellido ),
      desafiado:desafiado_id   ( nombre, apellido )
    `)
    .eq('estado', 'pendiente_registro')
    .order('fecha_desafio', { ascending: true })
    .limit(10)

  const stats = [
    { label: 'Jugadores',            valor: totalJugadores,      icon: '👥', color: 'bg-blue-50 text-blue-700' },
    { label: 'Desafíos activos',     valor: desafiosActivos,     icon: '⚔️',  color: 'bg-purple-50 text-purple-700' },
    { label: 'Resultados pendientes',valor: partidosPendientes,  icon: '🎾',  color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Sanciones por aplicar',valor: sancionesPendientes, icon: '🚫',  color: 'bg-red-50 text-red-700' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{temporada?.nombre ?? 'Sin temporada activa'}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-5 ${s.color} bg-opacity-50`}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold">{s.valor ?? 0}</p>
            <p className="text-sm opacity-75 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Desafíos pendientes de validar */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          ⏳ Desafíos pendientes de registro
        </h2>
        {!pendientesRegistro?.length ? (
          <p className="text-gray-400 text-sm">No hay desafíos pendientes. ✅</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pendientesRegistro.map((d: any) => {
              const limite = d.fecha_limite_registro
                ? new Date(d.fecha_limite_registro)
                : null
              const vencido = limite ? limite < new Date() : false

              return (
                <div key={d.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {d.desafiante?.nombre} {d.desafiante?.apellido}
                      <span className="text-gray-400 mx-2">vs</span>
                      {d.desafiado?.nombre} {d.desafiado?.apellido}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(d.fecha_desafio).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {vencido && (
                      <span className="badge bg-red-100 text-red-700">Vencido</span>
                    )}
                    <a
                      href={`/admin/desafios/${d.id}`}
                      className="btn-primary text-xs py-1.5"
                    >
                      Revisar
                    </a>
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
