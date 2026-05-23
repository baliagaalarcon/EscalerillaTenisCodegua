// Página principal: ranking de la escalerilla
// Server Component — datos frescos en cada request
import { createClient } from '@/lib/supabase/server'
import RankingTable from '@/components/ranking/RankingTable'
import type { RankingJugador } from '@/lib/types/database.types'

export const metadata = { title: 'Ranking — Escalerilla Codegua' }

export default async function RankingPage() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioActual } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  // Temporada activa
  const { data: temporada } = await supabase
    .from('temporadas')
    .select('id, nombre')
    .eq('estado', 'activa')
    .single()

  // Ranking completo desde la vista
  const { data: ranking } = await supabase
    .from('v_ranking_actual')
    .select('*')
    .eq('temporada_id', temporada?.id ?? 0)
    .order('posicion', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Ranking Escalerilla</h1>
        <p className="text-sm text-gray-500 mt-0.5">{temporada?.nombre ?? '—'}</p>
      </div>

      {/* Tabla de ranking */}
      <RankingTable
        jugadores={(ranking ?? []) as RankingJugador[]}
        usuarioActualId={usuarioActual?.id ?? ''}
      />
    </div>
  )
}
