'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  Swords, Snowflake, ChevronRight, AlertCircle, CheckCircle2,
  Play, X, Info, CalendarDays, Clock, MessageCircle, Send,
  ArrowDownToLine, Pencil, Check, Hand, Mail, Phone, Cake,
  Activity, Wallet, ArrowUp, ArrowDown, Camera, Bell,
} from 'lucide-react'
import {
  TIER_META, PAUSA_META, getTierMeta,
  type PlayerRow, type PlayerDetail, type ActiveChallenge,
  type Notice, type MatchEntry,
} from '@/lib/types/ranking'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  players: PlayerRow[]
  challenges: ActiveChallenge[]
  meId: string
  notices: Notice[]
  temporadaId: number
  temporadaNombre: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client (singleton)
// ─────────────────────────────────────────────────────────────────────────────
function useSupabase() {
  const ref = useRef<ReturnType<typeof createBrowserClient> | null>(null)
  if (!ref.current) {
    ref.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return ref.current
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function calcAge(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null
  const dob = new Date(fechaNacimiento)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function canChallenge(me: PlayerRow, target: PlayerRow, challenges: ActiveChallenge[]): { ok: boolean; reason: string } {
  if (me.id === target.id)  return { ok: false, reason: 'Eres tú' }
  if (me.paused)            return { ok: false, reason: 'Estás en pausa' }
  if (target.paused)        return { ok: false, reason: 'Jugador en pausa' }
  if (target.pos === null || me.pos === null) return { ok: false, reason: '—' }
  if (target.pos >= me.pos) return { ok: false, reason: 'Solo a posiciones superiores' }
  const gap = (me.tier ?? 10) - (target.tier ?? 10)
  if (gap > 1)              return { ok: false, reason: 'Más de 1 cuadro arriba' }
  if (!me.paid)             return { ok: false, reason: 'Tus cuotas no están al día' }
  if (!target.paid)         return { ok: false, reason: 'El rival no está al día' }
  const busy = challenges.find(c =>
    c.status === 'pendiente' &&
    (c.challengerId === me.id || c.challengedId === me.id ||
     c.challengerId === target.id || c.challengedId === target.id)
  )
  if (busy) {
    if (busy.challengerId === me.id || busy.challengedId === me.id)
      return { ok: false, reason: 'Ya tienes un desafío en curso' }
    return { ok: false, reason: 'Rival con desafío en curso' }
  }
  return { ok: true, reason: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, tier, paused, photo }: {
  name: string; size?: number; tier: number | null; paused?: boolean; photo?: string | null
}) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const m = paused ? PAUSA_META : getTierMeta(tier)
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0 select-none"
      style={{
        width: size, height: size,
        background: m.soft, color: m.text,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StreakDots
// ─────────────────────────────────────────────────────────────────────────────
function StreakDots({ streak = [] }: { streak: ('W' | 'L')[] }) {
  const arr = [...streak.slice(-5)]
  while (arr.length < 5) arr.unshift(null as unknown as 'W' | 'L')
  const color = (r: 'W' | 'L' | null) => {
    if (r === 'W') return 'oklch(0.55 0.13 150)'
    if (r === 'L') return 'oklch(0.60 0.18 25)'
    return 'oklch(0.86 0.01 150)'
  }
  return (
    <span className="inline-flex items-center gap-[3px]">
      {arr.map((r, i) => (
        <span key={i} className="dot" style={{ background: color(r) }} />
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TierPill
// ─────────────────────────────────────────────────────────────────────────────
function TierPill({ tier, paused }: { tier: number | null; paused?: boolean }) {
  const m = paused ? PAUSA_META : getTierMeta(tier)
  return (
    <span className="chip" style={{ background: m.soft, color: m.text }}>
      {paused ? 'Pausa' : `Cuadro ${tier}`}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PaidBadge
// ─────────────────────────────────────────────────────────────────────────────
function PaidBadge({ paid, compact }: { paid: boolean; compact?: boolean }) {
  if (paid) return (
    <span className="chip" style={{ background: 'oklch(0.94 0.04 155)', color: 'var(--court)' }}>
      <CheckCircle2 size={11} /> {compact ? 'Al día' : 'Cuotas al día'}
    </span>
  )
  return (
    <span className="chip" style={{ background: 'oklch(0.96 0.04 25)', color: 'var(--danger)' }}>
      <AlertCircle size={11} /> {compact ? 'Pendiente' : 'Cuotas pendientes'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card (inside modals)
// ─────────────────────────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white px-3 py-3 text-center">
      <div className="font-display text-[24px] font-semibold leading-none tabular-nums" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] mt-1 font-mono" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="sheet w-full max-w-[440px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 60px oklch(0.20 0.02 150 / 0.30)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleResultBadge (match history)
// ─────────────────────────────────────────────────────────────────────────────
function RoleResultBadge({ role, result, size = 36 }: {
  role: string | null; result: string; size?: number
}) {
  if (result === '—') return (
    <span className="rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--paper-2)', color: 'var(--ink-3)', width: size, height: size }}>
      <Snowflake size={Math.round(size * 0.45)} />
    </span>
  )
  const isWin = result === 'W'
  const isDefender = role === 'defender'
  const bg = isWin ? 'oklch(0.94 0.04 150)' : 'oklch(0.96 0.04 25)'
  const fg = isWin ? 'oklch(0.40 0.10 150)' : 'var(--danger)'
  const label = isDefender
    ? (isWin ? 'Defendí y gané' : 'Fui desafiado y perdí')
    : (isWin ? 'Desafié y gané' : 'Desafié y perdí')
  return (
    <span className="rounded-lg flex items-center justify-center shrink-0 text-[10px] font-mono font-bold"
          style={{ background: bg, color: fg, width: size, height: size }}
          title={label}>
      {isDefender ? '🛡' : '⚔️'}
      {isWin ? 'G' : 'P'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RankDelta
// ─────────────────────────────────────────────────────────────────────────────
function RankDelta({ before, after }: { before: number | null; after: number | null }) {
  if (before === null || after === null) return null
  if (before === after) return (
    <div className="text-[11px] font-mono tabular-nums mt-0.5 flex items-center justify-end gap-0.5"
         style={{ color: 'var(--ink-3)' }}>
      <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>#{after}</span>
    </div>
  )
  const up = after < before
  const color = up ? 'oklch(0.45 0.13 150)' : 'var(--danger)'
  return (
    <div className="text-[11px] font-mono tabular-nums mt-0.5 flex items-center justify-end gap-0.5"
         style={{ color: 'var(--ink-3)' }}>
      <span>#{before}</span>
      {up ? <ArrowUp size={10} className="mx-px" /> : <ArrowDown size={10} className="mx-px" />}
      <span style={{ color, fontWeight: 600 }}>#{after}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
type ToastData = { title: string; body: string; tone: 'court' | 'clay' | 'net' }
function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const bg = toast.tone === 'court' ? 'var(--court)'
           : toast.tone === 'clay'  ? 'var(--clay)' : 'var(--net)'
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-[340px] w-full mx-4"
      style={{ background: bg, color: 'white', animation: 'rise .22s cubic-bezier(.2,.9,.3,1) both' }}
      onClick={onDismiss}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14px]">{toast.title}</div>
        <div className="text-[12px] mt-0.5 opacity-90">{toast.body}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileModal — carga detalles del jugador al abrir
// ─────────────────────────────────────────────────────────────────────────────
function ProfileModal({ playerId, me, challenges, onClose, onChallenge, onReactivate }: {
  playerId: string
  me: PlayerRow
  challenges: ActiveChallenge[]
  onClose: () => void
  onChallenge: (id: string) => void
  onReactivate: (id: string) => void
}) {
  const supabase = useSupabase()
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const isMe = playerId === me.id

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Usuario base
      const { data: u } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, telefono, foto_url, estado, posicion_congelamiento, grupo_congelamiento, motivo_pausa, mano, fecha_nacimiento, created_at, cuotas_al_dia')
        .eq('id', playerId)
        .single()

      // Historial de partidos
      const { data: hist } = await supabase
        .from('v_historial_partidos')
        .select('*')
        .or(`ganador_id.eq.${playerId},perdedor_id.eq.${playerId}`)
        .order('fecha_jugado', { ascending: false })
        .limit(16)

      // WOs del jugador
      const { data: wos } = await supabase
        .from('v_wo_por_mes')
        .select('cantidad_wo')
        .eq('usuario_id', playerId)

      if (!u) { setLoading(false); return }

      const paused = u.estado === 'pausado'
      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

      const history: MatchEntry[] = (hist ?? []).map((h: Record<string, unknown>) => {
        const iWon = h.ganador_id === playerId
        const oppName = iWon
          ? `${h.nombre_perdedor} ${h.apellido_perdedor}`
          : `${h.nombre_ganador} ${h.apellido_ganador}`
        const d = h.fecha_jugado ? new Date(h.fecha_jugado as string) : null
        const score = h.set1_ganador !== null
          ? (() => {
              const s1 = iWon ? `${h.set1_ganador}-${h.set1_perdedor}` : `${h.set1_perdedor}-${h.set1_ganador}`
              const s2 = iWon ? `${h.set2_ganador}-${h.set2_perdedor}` : `${h.set2_perdedor}-${h.set2_ganador}`
              const stb = (h.stb_ganador !== null && h.stb_perdedor !== null)
                ? `, ${iWon ? h.stb_ganador : h.stb_perdedor}-${iWon ? h.stb_perdedor : h.stb_ganador}`
                : ''
              return `${s1}, ${s2}${stb}`
            })()
          : (h.es_wo ? 'W.O.' : '—')
        return {
          vsName: (oppName as string).trim(),
          result: iWon ? 'W' : 'L',
          score,
          date: d ? `${d.getDate()} ${months[d.getMonth()]}` : '—',
          role: h.desafiante_id === playerId ? 'challenger' : 'defender',
          posBefore: null,
          posAfter: null,
        }
      })

      const wins = history.filter(h => h.result === 'W').length
      const losses = history.filter(h => h.result === 'L').length
      const streak = history.slice(0, 5).map(h => h.result).filter((r): r is 'W' | 'L' => (r as string) !== '—')
      const woTotal = (wos ?? []).reduce((s: number, r: Record<string, unknown>) => s + ((r.cantidad_wo as number) ?? 0), 0)

      setDetail({
        id: u.id,
        pos: null,  // se tomará del listado de players
        nombre: `${u.nombre} ${u.apellido}`.trim(),
        tier: u.grupo_congelamiento ?? null,
        paid: u.cuotas_al_dia,
        paused,
        hasChallenge: false,
        frozenPos: u.posicion_congelamiento,
        frozenTier: u.grupo_congelamiento,
        pauseReason: u.motivo_pausa,
        photo: u.foto_url,
        hand: u.mano,
        age: calcAge(u.fecha_nacimiento),
        joined: u.created_at ? new Date(u.created_at as string).getFullYear().toString() : '—',
        email: u.email,
        phone: u.telefono,
        wins,
        losses,
        wo: woTotal,
        streak,
        history,
      })
      setLoading(false)
    }
    load()
  }, [playerId, supabase])

  // Enrich with position data from players list
  const [allPlayers] = useState<PlayerRow[]>([])

  const challengeState = detail && me ? canChallenge(me, { ...detail, pos: allPlayers.find(p => p.id === playerId)?.pos ?? null }, challenges) : { ok: false, reason: '—' }
  const activeChallenge = challenges.find(c => c.challengerId === playerId || c.challengedId === playerId)
  const meta = getTierMeta(detail?.tier ?? null)

  return (
    <Modal onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center p-12" style={{ color: 'var(--ink-3)' }}>
          <div className="text-[13px]">Cargando…</div>
        </div>
      ) : !detail ? (
        <div className="p-8 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
          No se encontró el jugador.
          <button className="btn btn-ghost mt-4 w-full" onClick={onClose}>Cerrar</button>
        </div>
      ) : (
        <>
          <div className="h-1.5" style={{ background: detail.paused ? PAUSA_META.color : meta.color }} />

          {/* Header */}
          <div className="px-5 pt-4 pb-3 flex items-start gap-4">
            <Avatar name={detail.nombre} size={64} tier={detail.tier} paused={detail.paused} photo={detail.photo} />
            <div className="flex-1 min-w-0">
              {detail.paused ? (
                <div className="text-[11px] uppercase tracking-[0.14em] font-mono flex items-center gap-1.5"
                     style={{ color: PAUSA_META.text }}>
                  <Snowflake size={11} /> Pausa · congelado en #{detail.frozenPos}
                </div>
              ) : (
                <div className="text-[11px] uppercase tracking-[0.14em] font-mono" style={{ color: 'var(--ink-3)' }}>
                  Socio desde {detail.joined}
                </div>
              )}
              <div className="font-display text-[22px] font-semibold leading-tight truncate">{detail.nombre}</div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <TierPill tier={detail.tier} paused={detail.paused} />
                <PaidBadge paid={detail.paid} compact />
                {detail.age !== null && (
                  <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {detail.age} años{detail.hand ? ` · ${detail.hand}` : ''}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Pausa info */}
          {detail.paused && detail.pauseReason && (
            <div className="mx-5 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                 style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
              <Info size={14} className="mt-0.5 shrink-0" />
              <div className="text-[12px] leading-relaxed">
                <b>{detail.pauseReason}</b> — ranking congelado en posición <b>#{detail.frozenPos}</b>
                {detail.frozenTier ? ` (Cuadro ${detail.frozenTier})` : ''}.
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px mx-5 mt-2 rounded-xl overflow-hidden"
               style={{ background: 'var(--line)' }}>
            <Stat label="Ganados"  value={detail.wins}   accent="var(--court)" />
            <Stat label="Perdidos" value={detail.losses} accent="var(--clay)" />
            <Stat label="W.O."     value={detail.wo}     accent={detail.wo > 1 ? 'var(--danger)' : 'var(--ink-2)'} />
          </div>

          {/* Últimos 3 partidos */}
          <div className="px-5 mt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-[15px] font-semibold">Últimos partidos</h3>
              {detail.streak.length > 0 && <StreakDots streak={detail.streak} />}
            </div>
            <ul className="card divide-y" style={{ borderColor: 'var(--line)' }}>
              {detail.history.slice(0, 5).length === 0 ? (
                <li className="px-3 py-4 text-center text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  Sin partidos registrados aún.
                </li>
              ) : detail.history.slice(0, 5).map((m, i) => (
                <li key={i} className="px-3 py-2.5 flex items-center gap-3">
                  <RoleResultBadge role={m.role} result={m.result} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      {m.result === '—' ? m.vsName : `vs ${m.vsName}`}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--ink-3)' }}>
                      {m.score}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                      {m.date}
                    </div>
                    <RankDelta before={m.posBefore} after={m.posAfter} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="px-5 pt-4 pb-5 mt-1 flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cerrar</button>
            {isMe && detail.paused && (
              <button onClick={() => onReactivate(me.id)} className="btn btn-primary flex-1">
                <Play size={14} /> Reactivar
              </button>
            )}
            {!isMe && !detail.paused && (
              challengeState.ok ? (
                <button onClick={() => onChallenge(playerId)} className="btn btn-primary flex-1">
                  <Swords size={14} /> Desafiar
                </button>
              ) : (
                <button className="btn btn-primary flex-1" disabled title={challengeState.reason}>
                  {me.paused ? <Snowflake size={14} /> : null} {challengeState.reason}
                </button>
              )
            )}
            {!isMe && detail.paused && (
              <button className="btn btn-primary flex-1" disabled>
                <Snowflake size={14} /> En pausa
              </button>
            )}
          </div>

          {activeChallenge && !isMe && !detail.paused && (
            <div className="mx-5 mb-5 -mt-3 rounded-lg px-3 py-2 text-[12px] flex items-center gap-2"
                 style={{ background: 'var(--clay-soft)', color: 'oklch(0.42 0.12 35)' }}>
              <Swords size={12} /> Jugador con desafío en curso.
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChallengeModal — formulario simplificado (fecha, hora, nota)
// ─────────────────────────────────────────────────────────────────────────────
function ChallengeModal({ target, me, onClose, onSubmit }: {
  target: PlayerRow
  me: PlayerRow
  onClose: () => void
  onSubmit: (payload: { date: string; time: string; note: string }) => void
}) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate() + 3).padStart(2, '0')
  const [date, setDate] = useState(`${yyyy}-${mm}-${dd}`)
  const [time, setTime] = useState('19:00')
  const [note, setNote] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [progress, setProgress] = useState(0)
  const tMeta = getTierMeta(target.tier)
  const mMeta = getTierMeta(me.tier)

  function submit() { setStep(2); setTimeout(() => setProgress(1), 60) }
  function confirmDone() { onSubmit({ date, time, note }) }

  return (
    <Modal onClose={onClose}>
      {step === 1 && (
        <>
          <div className="px-5 pt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: 'var(--clay-soft)', color: 'oklch(0.42 0.12 35)' }}>
              <Swords size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
                Nuevo desafío
              </div>
              <div className="font-display text-[18px] font-semibold leading-tight truncate">
                {me.nombre.split(' ')[0]} → {target.nombre}
              </div>
            </div>
            <button onClick={onClose}
                    className="ml-auto w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Versus strip */}
          <div className="px-5 mt-3">
            <div className="rounded-xl p-3 flex items-center gap-3"
                 style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <Avatar name={me.nombre} size={36} tier={me.tier} photo={me.photo} />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                    #{me.pos} · C{me.tier}
                  </div>
                  <div className="text-[13px] font-semibold truncate">{me.nombre}</div>
                </div>
              </div>
              <div className="font-display text-[14px] font-bold px-2 py-0.5 rounded-md"
                   style={{ background: 'var(--court)', color: 'white' }}>VS</div>
              <div className="flex-1 flex items-center gap-2.5 min-w-0 flex-row-reverse text-right">
                <Avatar name={target.nombre} size={36} tier={target.tier} photo={target.photo} />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                    #{target.pos} · C{target.tier}
                  </div>
                  <div className="text-[13px] font-semibold truncate">{target.nombre}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 mt-4 grid grid-cols-2 gap-3">
            <label className="rounded-xl px-3 py-2 block"
                   style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-mono"
                   style={{ color: 'var(--ink-3)' }}>
                <CalendarDays size={11} /> Fecha
              </div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                     className="w-full bg-transparent outline-none text-[14px] font-medium mt-0.5" />
            </label>
            <label className="rounded-xl px-3 py-2 block"
                   style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-mono"
                   style={{ color: 'var(--ink-3)' }}>
                <Clock size={11} /> Hora
              </div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                     className="w-full bg-transparent outline-none text-[14px] font-medium mt-0.5" />
            </label>
          </div>

          <div className="px-5 mt-3">
            <label className="rounded-xl px-3 py-2 block"
                   style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-mono"
                   style={{ color: 'var(--ink-3)' }}>
                <MessageCircle size={11} /> Mensaje (opcional)
              </div>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                        placeholder="Coordinar antes del partido…"
                        className="w-full bg-transparent outline-none text-[13px] resize-none mt-1" />
            </label>
          </div>

          <div className="px-5 mt-3 rounded-xl p-3 flex items-start gap-2.5 mx-5"
               style={{ background: 'var(--net-soft)', color: 'oklch(0.32 0.07 235)' }}>
            <Info size={14} className="mt-0.5 shrink-0" />
            <p className="text-[12px] leading-relaxed">
              {target.nombre.split(' ')[0]} tiene <b>24 horas</b> para confirmar el horario.
              Si no responde, la directiva resuelve al 5° día.
            </p>
          </div>

          <div className="px-5 pt-4 pb-5 flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
            <button onClick={submit} className="btn btn-primary flex-1">
              <Send size={14} /> Enviar desafío
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="px-5 pt-6 text-center">
            <div className="mx-auto relative" style={{ width: 112, height: 112 }}>
              <svg viewBox="0 0 100 100" width="112" height="112">
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--paper-2)" strokeWidth="6" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--court)" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 44}
                        strokeDashoffset={(1 - progress) * 2 * Math.PI * 44}
                        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(.4,.8,.4,1)', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-[26px] font-semibold leading-none tabular-nums">24h</div>
                <div className="text-[10px] mt-0.5 font-mono uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                  Respuesta
                </div>
              </div>
            </div>
            <div className="mt-4 font-display text-[20px] font-semibold">¡Desafío enviado!</div>
            <p className="text-[13px] mt-1.5 max-w-[300px] mx-auto" style={{ color: 'var(--ink-2)' }}>
              {target.nombre.split(' ')[0]} debe confirmar el horario en las próximas <b>24 horas</b>.
            </p>
          </div>
          <div className="px-5 mt-4">
            <div className="card p-3 text-[13px] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
                  <CalendarDays size={12} />
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] font-mono" style={{ color: 'var(--ink-3)' }}>Fecha</span>
                <span className="ml-auto text-[13px] font-medium">{fmtDate(date)} · {time}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
                  <Wallet size={12} />
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] font-mono" style={{ color: 'var(--ink-3)' }}>Pago cancha</span>
                <span className="ml-auto text-[13px] font-medium">50% / 50%</span>
              </div>
            </div>
          </div>
          <div className="px-5 pt-4 pb-5 flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cerrar</button>
            <button onClick={confirmDone} className="btn btn-dark flex-1">
              <CheckCircle2 size={14} /> Hecho
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ReactivateModal
// ─────────────────────────────────────────────────────────────────────────────
function ReactivateModal({ player, onClose, onBottom }: {
  player: PlayerRow
  onClose: () => void
  onBottom: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="h-1.5" style={{ background: PAUSA_META.color }} />
      <div className="px-5 pt-5 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
          <Play size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
            Reactivar pausa · Regla 16
          </div>
          <div className="font-display text-[18px] font-semibold leading-tight">
            Vuelves al juego, {player.nombre.split(' ')[0]}
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
          <X size={16} />
        </button>
      </div>
      {player.pauseReason && (
        <div className="px-5 mt-3">
          <div className="rounded-xl p-3 text-[12px] leading-relaxed flex items-start gap-2"
               style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
            <Info size={13} className="mt-0.5 shrink-0" />
            <div>
              Estuviste en pausa por <b>{player.pauseReason.toLowerCase()}</b>.
              Al reactivarte puedes volver al final de la escalerilla.
            </div>
          </div>
        </div>
      )}
      <div className="px-5 mt-3 space-y-2">
        <button onClick={onBottom}
                className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition-colors"
                style={{ border: '1px solid var(--court)', background: 'oklch(0.97 0.03 155)' }}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--court)', color: 'white' }}>
            <ArrowDownToLine size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-[14px]">Reincorporarme al ranking</span>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'var(--court)', color: 'white' }}>Recomendado</span>
            </span>
            <span className="block text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Volver al final de la escalerilla (Cuadro 10)
            </span>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="px-5 pt-4 pb-5">
        <button onClick={onClose} className="btn btn-ghost w-full">Cerrar sin reactivar</button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MyStatusCard
// ─────────────────────────────────────────────────────────────────────────────
function MyStatusCard({ me, myChallenge, opponent, onOpenProfile, onReactivate }: {
  me: PlayerRow
  myChallenge: ActiveChallenge | undefined
  opponent: PlayerRow | undefined
  onOpenProfile: (id: string) => void
  onReactivate: (id: string) => void
}) {
  const meta = getTierMeta(me.tier)
  const hours = myChallenge ? Math.max(0, Math.round((myChallenge.dueAt.getTime() - Date.now()) / 3600000)) : null

  if (me.paused) return (
    <div className="card overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
         onClick={() => onOpenProfile(me.id)} role="button" tabIndex={0}>
      <div className="h-1.5" style={{ background: PAUSA_META.color }} />
      <div className="p-4 flex items-center gap-3">
        <Avatar name={me.nombre} size={52} tier={me.tier} paused photo={me.photo} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-[15px] truncate">{me.nombre}</div>
            <span className="chip" style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
              <Snowflake size={11} /> Pausa
            </span>
          </div>
          <div className="text-[11px] mt-1 font-mono leading-snug" style={{ color: 'var(--ink-3)' }}>
            {me.pauseReason || 'En pausa'} · congelado en <b style={{ color: 'var(--ink-2)' }}>#{me.frozenPos}</b>
            {me.frozenTier ? ` (Cuadro ${me.frozenTier})` : ''}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onReactivate(me.id) }} className="btn btn-primary shrink-0">
          <Play size={13} /> Reactivar
        </button>
      </div>
    </div>
  )

  return (
    <div className="card p-4 flex items-center gap-3 cursor-pointer transition-shadow hover:shadow-md"
         onClick={() => onOpenProfile(me.id)} role="button" tabIndex={0}>
      <Avatar name={me.nombre} size={52} tier={me.tier} photo={me.photo} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold text-[15px] truncate">{me.nombre}</div>
          <TierPill tier={me.tier} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-[12px]" style={{ color: 'var(--ink-2)' }}>
          <span className="font-mono">#{me.pos}</span>
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        {myChallenge ? (
          <div className="text-right">
            <div className="chip" style={{ background: 'var(--clay-soft)', color: 'oklch(0.42 0.12 35)' }}>
              <Swords size={11} /> En curso
            </div>
            {opponent && (
              <div className="text-[11px] mt-1 font-mono tabular-nums" style={{ color: 'var(--ink-3)' }}>
                vs {opponent.nombre.split(' ')[0]} · {hours}h
              </div>
            )}
          </div>
        ) : me.paid ? (
          <div className="chip" style={{ background: 'oklch(0.94 0.04 155)', color: 'var(--court)' }}>
            <span className="dot" style={{ background: 'var(--court)' }} /> Disponible
          </div>
        ) : (
          <div className="chip" style={{ background: 'oklch(0.96 0.04 25)', color: 'var(--danger)' }}>
            <AlertCircle size={11} /> Sin cuotas
          </div>
        )}
        <ChevronRight size={16} className="opacity-40" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NoticesStrip
// ─────────────────────────────────────────────────────────────────────────────
function NoticesStrip({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null
  const tone = (t: Notice['tone']) => {
    if (t === 'clay') return { bg: 'var(--clay-soft)', fg: 'oklch(0.42 0.12 35)' }
    if (t === 'net')  return { bg: 'var(--net-soft)',  fg: 'oklch(0.32 0.07 235)' }
    return               { bg: 'oklch(0.94 0.04 155)', fg: 'var(--court)' }
  }
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {notices.map(n => {
        const c = tone(n.tone)
        return (
          <div key={n.id}
               className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-2 max-w-[78%]"
               style={{ background: c.bg, color: c.fg }}>
            <span className="text-[14px]">{n.icon}</span>
            <span className="text-[12px] font-medium">{n.text}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TierJumpStrip
// ─────────────────────────────────────────────────────────────────────────────
function TierJumpStrip({ me, tiers, pausedCount }: {
  me: PlayerRow
  tiers: number[]
  pausedCount: number
}) {
  function jumpTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const rect = el.getBoundingClientRect()
    window.scrollBy({ top: rect.top - 64, behavior: 'smooth' })
  }
  return (
    <div className="sticky top-0 -mx-4 px-4 py-2 z-30"
         style={{ background: 'color-mix(in oklch, var(--paper-2) 92%, transparent)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center gap-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] shrink-0 mr-1.5" style={{ color: 'var(--ink-3)' }}>
          Cuadros
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
          {tiers.map(t => {
            const m = getTierMeta(t) as typeof TIER_META[0]
            const isMine = me.tier === t && !me.paused
            return (
              <button key={t}
                      onClick={() => jumpTo(`tier-${t}`)}
                      className="relative shrink-0 rounded-md font-mono text-[12px] font-semibold leading-none flex items-center justify-center"
                      style={{
                        padding: '6px 0', minWidth: 28,
                        background: isMine ? m.color : m.soft,
                        color: isMine ? 'white' : m.text,
                        boxShadow: isMine ? `0 0 0 2px white, 0 0 0 3px ${m.color}` : `inset 0 0 0 1px ${m.soft}`,
                      }}>
                {t}
              </button>
            )
          })}
          {pausedCount > 0 && (
            <button onClick={() => jumpTo('tier-pausa')}
                    className="relative shrink-0 rounded-md font-mono text-[12px] font-semibold leading-none flex items-center justify-center"
                    style={{
                      padding: '6px 0', minWidth: 28,
                      background: me.paused ? PAUSA_META.color : PAUSA_META.soft,
                      color: me.paused ? 'white' : PAUSA_META.text,
                      boxShadow: me.paused ? `0 0 0 2px white, 0 0 0 3px ${PAUSA_META.color}` : 'inset 0 0 0 1px var(--line)',
                    }}>
              ❄
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayerRow (list item)
// ─────────────────────────────────────────────────────────────────────────────
function PlayerListRow({ player, me, challenges, onOpenProfile, onChallenge }: {
  player: PlayerRow
  me: PlayerRow
  challenges: ActiveChallenge[]
  onOpenProfile: (id: string) => void
  onChallenge: (id: string) => void
}) {
  const isMe = player.id === me.id
  const state = canChallenge(me, player, challenges)
  const busy = challenges.find(c => c.challengerId === player.id || c.challengedId === player.id)

  return (
    <div
      className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
      style={{ background: isMe ? 'oklch(0.97 0.02 155)' : 'transparent' }}
      onClick={() => onOpenProfile(player.id)}
      role="button"
      tabIndex={0}
    >
      <div className="font-mono tabular-nums text-[15px] w-8 text-center font-semibold"
           style={{ color: 'var(--ink-2)' }}>
        {String(player.pos).padStart(2, '0')}
      </div>
      <Avatar name={player.nombre} size={36} tier={player.tier} photo={player.photo} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="font-semibold text-[14px] truncate">{player.nombre}</div>
          {isMe && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'var(--court)', color: 'white' }}>Tú</span>
          )}
          {!player.paid && (
            <AlertCircle size={12} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {busy && (
            <span className="chip" style={{ background: 'var(--clay-soft)', color: 'oklch(0.42 0.12 35)' }}>
              <Swords size={10} /> En curso
            </span>
          )}
        </div>
      </div>

      {!isMe && state.ok && (
        <button
          onClick={e => { e.stopPropagation(); onChallenge(player.id) }}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0"
          style={{ background: 'var(--clay)', color: 'white', boxShadow: '0 1px 0 oklch(0.50 0.13 40) inset, 0 1px 3px oklch(0.30 0.05 40 / 0.25)' }}
          aria-label="Desafiar"
        >
          <Swords size={15} />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TierSection
// ─────────────────────────────────────────────────────────────────────────────
function TierSection({ tier, players, challenges, me, onOpenProfile, onChallenge }: {
  tier: number
  players: PlayerRow[]
  challenges: ActiveChallenge[]
  me: PlayerRow
  onOpenProfile: (id: string) => void
  onChallenge: (id: string) => void
}) {
  const meta = getTierMeta(tier) as typeof TIER_META[0]
  if (!players.length) return null
  return (
    <section id={`tier-${tier}`} className="card overflow-hidden scroll-mt-16">
      <div className="h-1.5" style={{ background: meta.color }} />
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="chip" style={{ background: meta.soft, color: meta.text }}>
          Cuadro {tier} · {meta.name}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
          {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--line-2)' }}>
        {players.map(p => (
          <PlayerListRow
            key={p.id}
            player={p}
            me={me}
            challenges={challenges}
            onOpenProfile={onOpenProfile}
            onChallenge={onChallenge}
          />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PausaSection
// ─────────────────────────────────────────────────────────────────────────────
function PausaSection({ players, me, onOpenProfile, onReactivate }: {
  players: PlayerRow[]
  me: PlayerRow
  onOpenProfile: (id: string) => void
  onReactivate: (id: string) => void
}) {
  if (!players.length) return null
  return (
    <section id="tier-pausa" className="card overflow-hidden scroll-mt-16"
             style={{ background: 'color-mix(in oklch, var(--paper-2) 60%, white)' }}>
      <div className="h-1.5" style={{ background: PAUSA_META.color }} />
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="chip" style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
          <Snowflake size={11} /> Pausa
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
          ranking congelado
        </span>
      </div>
      <div className="px-4 py-2 text-[11px] leading-relaxed font-mono"
           style={{ color: 'var(--ink-3)', borderTop: '1px dashed var(--line)' }}>
        Socios con posición congelada. Al reactivarse vuelven al final de la escalerilla.
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--line-2)' }}>
        {players.map(p => {
          const isMe = p.id === me.id
          return (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3"
                 style={{ background: isMe ? 'white' : 'transparent' }}>
              <button onClick={() => onOpenProfile(p.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-8 flex items-center justify-center" style={{ color: PAUSA_META.text }}>
                  <Snowflake size={14} />
                </div>
                <Avatar name={p.nombre} size={36} tier={null} paused photo={p.photo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-semibold text-[14px] truncate" style={{ color: 'var(--ink-2)' }}>
                      {p.nombre}
                    </div>
                    {isMe && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                            style={{ background: 'var(--court)', color: 'white' }}>Tú</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono" style={{ color: 'var(--ink-3)' }}>
                    #{p.frozenPos} · C{p.frozenTier} · {p.pauseReason || 'En pausa'}
                  </div>
                </div>
              </button>
              {isMe ? (
                <button onClick={() => onReactivate(p.id)} className="btn btn-primary">
                  <Play size={13} /> Reactivar
                </button>
              ) : (
                <span className="chip max-w-[120px] truncate" title={p.pauseReason ?? ''}
                      style={{ background: PAUSA_META.soft, color: PAUSA_META.text }}>
                  {p.pauseReason || 'En pausa'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rules footer
// ─────────────────────────────────────────────────────────────────────────────
function RulesFooter() {
  return (
    <div className="rounded-xl p-3.5 text-[11px] leading-relaxed font-mono"
         style={{ background: 'white', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
      <div className="uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--ink-2)' }}>Reglas resumidas</div>
      <ul className="space-y-1">
        <li>· Solo a posiciones superiores, máximo 1 cuadro de color arriba.</li>
        <li>· El desafiado tiene 24 h para responder con horarios.</li>
        <li>· Pago de cancha 50/50. El desafiante pone las pelotas.</li>
        <li>· Cuotas pendientes inhabilitan al jugador (regla 15).</li>
        <li>· Pausa congela tu posición — al volver, llegas al final del ranking (regla 16).</li>
        <li>· 2.º W.O. en el mes: $5.000 + descenso de 10 puestos (regla 11).</li>
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroHeader
// ─────────────────────────────────────────────────────────────────────────────
function HeroHeader({ me, temporadaNombre }: { me: PlayerRow | null; temporadaNombre: string }) {
  const firstName = me?.nombre.split(' ')[0] ?? ''
  return (
    <div style={{ background: 'var(--court-3)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-6">
        {/* Club brand */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0"
              style={{ background: 'var(--court-2)', color: 'white', fontSize: 16, fontFamily: 'var(--font-bricolage)' }}
            >
              C
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] font-mono"
                   style={{ color: 'oklch(1 0 0 / 0.55)' }}>Club de Tenis</div>
              <div className="font-bold text-[15px] leading-none"
                   style={{ color: 'white', fontFamily: 'var(--font-bricolage)' }}>Codegua</div>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'oklch(1 0 0 / 0.10)', color: 'oklch(1 0 0 / 0.75)', border: 'none', cursor: 'pointer' }}
          >
            <Bell size={17} />
          </button>
        </div>

        {/* User greeting + position */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1.5"
                 style={{ color: 'oklch(1 0 0 / 0.50)' }}>
              Escalerilla · {temporadaNombre}
            </div>
            <div className="font-bold leading-tight truncate"
                 style={{ fontSize: 26, fontFamily: 'var(--font-bricolage)', letterSpacing: '-0.02em', color: 'white' }}>
              {firstName ? `Hola, ${firstName}.` : 'Escalerilla'}
            </div>
          </div>
          {me && !me.paused && me.pos ? (
            <div className="text-right shrink-0">
              <div className="font-bold tabular-nums leading-none"
                   style={{ fontSize: 42, fontFamily: 'var(--font-bricolage)', letterSpacing: '-0.03em', color: 'white' }}>
                #{me.pos}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono mt-0.5"
                   style={{ color: 'oklch(1 0 0 / 0.55)' }}>
                Cuadro {me.tier}
              </div>
            </div>
          ) : me?.paused ? (
            <div className="shrink-0">
              <span className="chip" style={{ background: 'oklch(1 0 0 / 0.12)', color: 'oklch(1 0 0 / 0.80)' }}>
                <Snowflake size={11} /> En pausa
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RankingApp — Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function RankingApp({ players: initial, challenges: initialChallenges, meId, notices, temporadaId, temporadaNombre }: Props) {
  const supabase = useSupabase()

  const [players] = useState<PlayerRow[]>(initial)
  const [challenges, setChallenges] = useState<ActiveChallenge[]>(initialChallenges)

  const [profileId, setProfileId] = useState<string | null>(null)
  const [challengeTargetId, setChallengeTargetId] = useState<string | null>(null)
  const [reactivateId, setReactivateId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  const me = players.find(p => p.id === meId) ?? players[0]

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(id)
  }, [toast])

  function openProfile(id: string) { setProfileId(id) }
  function openChallenge(id: string) { setChallengeTargetId(id); setProfileId(null) }
  function openReactivate(id: string) { setReactivateId(id); setProfileId(null) }

  async function submitChallenge(targetId: string, payload: { date: string; time: string; note: string }) {
    const target = players.find(p => p.id === targetId)
    if (!target || !me) return

    const { data, error } = await supabase
      .from('desafios')
      .insert({
        desafiante_id: me.id,
        desafiado_id: targetId,
        estado: 'pendiente',
        posicion_desafiante_snapshot: me.pos ?? 0,
        posicion_desafiado_snapshot: target.pos ?? 0,
        temporada_id: temporadaId,
        fecha_partido_acordada: payload.date,
        notas: payload.note || null,
        fecha_limite_confirmacion: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .select('id')
      .single()

    setChallengeTargetId(null)
    if (!error && data) {
      const newC: ActiveChallenge = {
        id: data.id,
        challengerId: me.id,
        challengedId: targetId,
        status: 'pendiente',
        scheduledDate: payload.date,
        scheduledTime: payload.time,
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
        createdAt: new Date().toISOString(),
        notes: payload.note || null,
      }
      setChallenges(cs => [...cs, newC])
      setToast({
        title: 'Desafío enviado',
        body: `${me.nombre.split(' ')[0]} → ${target.nombre}. 24h para confirmar.`,
        tone: 'court',
      })
    } else {
      setToast({ title: 'Error', body: error?.message ?? 'No se pudo enviar el desafío.', tone: 'clay' })
    }
  }

  function reactivateToBottom(id: string) {
    // La lógica real debe ejecutarse en la DB; aquí mostramos el toast y cerramos el modal
    setReactivateId(null)
    const player = players.find(p => p.id === id)
    setToast({
      title: 'Solicitud enviada',
      body: `${player?.nombre.split(' ')[0]} — la directiva procesará tu reactivación.`,
      tone: 'net',
    })
  }

  const actives = players.filter(p => !p.paused).sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999))
  const paused  = players.filter(p => p.paused)
  const tiers = Array.from(new Set(actives.map(p => p.tier).filter(Boolean) as number[])).sort((a, b) => a - b)
  const grouped = tiers.map(t => ({ tier: t, players: actives.filter(p => p.tier === t) }))

  const myChallenge = challenges.find(c => c.challengerId === me?.id || c.challengedId === me?.id)
  const myOpponent = myChallenge
    ? players.find(p => p.id === (myChallenge.challengerId === me?.id ? myChallenge.challengedId : myChallenge.challengerId))
    : undefined

  const challengeTarget = players.find(p => p.id === challengeTargetId)
  const reactivatePlayer = players.find(p => p.id === reactivateId)

  if (!me) return (
    <>
      <HeroHeader me={null} temporadaNombre={temporadaNombre} />
      <div className="flex items-center justify-center p-12" style={{ color: 'var(--ink-3)' }}>
        <div className="text-[13px]">No se encontró tu perfil en el ranking activo.</div>
      </div>
    </>
  )

  return (
    <>
      <HeroHeader me={me} temporadaNombre={temporadaNombre} />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <MyStatusCard
        me={me}
        myChallenge={myChallenge}
        opponent={myOpponent}
        onOpenProfile={openProfile}
        onReactivate={openReactivate}
      />

      <NoticesStrip notices={notices} />

      <TierJumpStrip me={me} tiers={tiers} pausedCount={paused.length} />

      {grouped.map(g => (
        <TierSection
          key={g.tier}
          tier={g.tier}
          players={g.players}
          challenges={challenges}
          me={me}
          onOpenProfile={openProfile}
          onChallenge={openChallenge}
        />
      ))}

      <PausaSection
        players={paused}
        me={me}
        onOpenProfile={openProfile}
        onReactivate={openReactivate}
      />

      <RulesFooter />

      {/* Modals */}
      {profileId && (
        <ProfileModal
          playerId={profileId}
          me={me}
          challenges={challenges}
          onClose={() => setProfileId(null)}
          onChallenge={openChallenge}
          onReactivate={openReactivate}
        />
      )}

      {challengeTargetId && challengeTarget && (
        <ChallengeModal
          target={challengeTarget}
          me={me}
          onClose={() => setChallengeTargetId(null)}
          onSubmit={payload => submitChallenge(challengeTargetId, payload)}
        />
      )}

      {reactivateId && reactivatePlayer && (
        <ReactivateModal
          player={reactivatePlayer}
          onClose={() => setReactivateId(null)}
          onBottom={() => reactivateToBottom(reactivateId)}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      </div>
    </>
  )
}
