import { createClient } from '@/lib/supabase/server'
import RankingApp from '@/components/ranking/RankingApp'
import type { PlayerRow, ActiveChallenge, Notice } from '@/lib/types/ranking'

export const metadata = { title: 'Ranking - Escalerilla Codegua' }

export default async function RankingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: yo } = user
    ? await (supabase
        .from('usuarios')
        .select('id, nombre, apellido, foto_url, estado, posicion_congelamiento, grupo_congelamiento, motivo_pausa, cuotas_al_dia')
        .eq('auth_id', user.id)
        .single() as any)
    : { data: null }

  const { data: temporada } = await supabase
    .from('temporadas')
    .select('id, nombre')
    .eq('estado', 'activa')
    .single()

  if (!temporada) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center" style={{ color: 'var(--ink-3)' }}>
        <div className="font-display text-[20px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>
          Sin temporada activa
        </div>
        <div className="text-[13px]">La directiva no ha iniciado la temporada.</div>
      </div>
    )
  }

  const { data: rankingRaw } = await supabase
    .from('v_ranking_actual')
    .select('usuario_id, posicion, nombre, apellido, cuotas_al_dia, foto_url, grupo_orden, tiene_desafio_activo')
    .eq('temporada_id', temporada.id)
    .order('posicion', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pausadosRaw } = await (supabase
    .from('usuarios')
    .select('id, nombre, apellido, foto_url, posicion_congelamiento, grupo_congelamiento, motivo_pausa, cuotas_al_dia')
    .eq('estado', 'pausado') as any)

  const { data: desafiosRaw } = await supabase
    .from('desafios')
    .select('id, desafiante_id, desafiado_id, estado, fecha_partido_acordada, notas, fecha_limite_confirmacion, created_at')
    .eq('temporada_id', temporada.id)
    .in('estado', ['pendiente', 'confirmado'])

  const activePlayers: PlayerRow[] = (rankingRaw ?? []).map(r => ({
    id: r.usuario_id!,
    pos: r.posicion,
    nombre: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim(),
    tier: r.grupo_orden,
    paid: r.cuotas_al_dia ?? false,
    paused: false,
    hasChallenge: r.tiene_desafio_activo ?? false,
    frozenPos: null,
    frozenTier: null,
    pauseReason: null,
    photo: r.foto_url,
  }))

  const pausedPlayers: PlayerRow[] = (pausadosRaw ?? []).map((p: any) => ({
    id: p.id,
    pos: null,
    nombre: `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim(),
    tier: null,
    paid: p.cuotas_al_dia ?? false,
    paused: true,
    hasChallenge: false,
    frozenPos: p.posicion_congelamiento,
    frozenTier: p.grupo_congelamiento,
    pauseReason: p.motivo_pausa,
    photo: p.foto_url,
  }))

  const allPlayers: PlayerRow[] = [...activePlayers, ...pausedPlayers]

  if (yo) {
    const meInList = allPlayers.find(p => p.id === yo.id)
    if (meInList && !meInList.paused) {
      meInList.frozenPos = yo.posicion_congelamiento ?? null
      meInList.frozenTier = yo.grupo_congelamiento ?? null
      meInList.pauseReason = yo.motivo_pausa ?? null
    }
  }

  const challenges: ActiveChallenge[] = (desafiosRaw ?? []).map(d => ({
    id: d.id,
    challengerId: d.desafiante_id,
    challengedId: d.desafiado_id,
    status: d.estado,
    scheduledDate: d.fecha_partido_acordada,
    scheduledTime: null,
    dueAt: d.fecha_limite_confirmacion
      ? new Date(d.fecha_limite_confirmacion)
      : new Date(Date.now() + 24 * 3600000),
    createdAt: d.created_at,
    notes: d.notas,
  }))

  const notices: Notice[] = []
  if (challenges.length > 0) {
    notices.push({ id: 'n1', icon: '⚔️', text: `${challenges.length} desafio${challenges.length === 1 ? '' : 's'} en curso`, tone: 'clay' })
  }
  if (pausedPlayers.length > 0) {
    notices.push({ id: 'n2', icon: '❄️', text: `${pausedPlayers.length} socio${pausedPlayers.length === 1 ? '' : 's'} en pausa`, tone: 'net' })
  }

  return (
    <RankingApp
      players={allPlayers}
      challenges={challenges}
      meId={yo?.id ?? ''}
      notices={notices}
      temporadaId={temporada.id}
      temporadaNombre={temporada.nombre}
    />
  )
}
