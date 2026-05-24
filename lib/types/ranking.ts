// Tipos para la escalerilla — interfaz visual

export type TierMeta = {
  tier: number
  name: string
  color: string
  soft: string
  text: string
}

export const TIER_META: TierMeta[] = [
  { tier: 1,  name: 'Élite',      color: 'oklch(0.45 0.07 155)', soft: 'oklch(0.94 0.04 155)', text: 'oklch(0.32 0.06 155)' },
  { tier: 2,  name: 'Maestros',   color: 'oklch(0.52 0.08 135)', soft: 'oklch(0.94 0.04 140)', text: 'oklch(0.34 0.07 135)' },
  { tier: 3,  name: 'Avanzado',   color: 'oklch(0.60 0.10 110)', soft: 'oklch(0.95 0.04 110)', text: 'oklch(0.38 0.09 110)' },
  { tier: 4,  name: 'Senior',     color: 'oklch(0.66 0.11 85)',  soft: 'oklch(0.96 0.04 85)',  text: 'oklch(0.42 0.10 80)'  },
  { tier: 5,  name: 'Plus',       color: 'oklch(0.64 0.12 60)',  soft: 'oklch(0.96 0.04 60)',  text: 'oklch(0.42 0.11 55)'  },
  { tier: 6,  name: 'Regulares',  color: 'oklch(0.62 0.13 40)',  soft: 'oklch(0.95 0.04 40)',  text: 'oklch(0.40 0.12 35)'  },
  { tier: 7,  name: 'Activos',    color: 'oklch(0.58 0.13 20)',  soft: 'oklch(0.95 0.04 20)',  text: 'oklch(0.40 0.12 15)'  },
  { tier: 8,  name: 'Sociales',   color: 'oklch(0.55 0.10 0)',   soft: 'oklch(0.95 0.03 0)',   text: 'oklch(0.40 0.10 0)'   },
  { tier: 9,  name: 'Iniciados',  color: 'oklch(0.55 0.07 340)', soft: 'oklch(0.95 0.025 340)', text: 'oklch(0.38 0.08 340)' },
  { tier: 10, name: 'Novatos',    color: 'oklch(0.55 0.05 290)', soft: 'oklch(0.95 0.02 290)', text: 'oklch(0.38 0.07 290)' },
]

export const PAUSA_META = {
  tier: null as null,
  name: 'Pausa',
  color: 'oklch(0.62 0.015 240)',
  soft:  'oklch(0.95 0.005 240)',
  text:  'oklch(0.38 0.015 240)',
}

export function getTierMeta(tier: number | null): TierMeta | typeof PAUSA_META {
  if (tier === null) return PAUSA_META
  return TIER_META.find(t => t.tier === tier) ?? TIER_META[TIER_META.length - 1]
}

// ── Player (vista lista) ─────────────────────────────────────────────────────
export type PlayerRow = {
  id: string
  pos: number | null
  nombre: string       // nombre completo "Nombre Apellido"
  tier: number | null  // grupo_orden, null si pausado
  paid: boolean
  paused: boolean
  hasChallenge: boolean
  frozenPos: number | null
  frozenTier: number | null
  pauseReason: string | null
  photo: string | null
}

// ── Player detalle (modal de perfil) ─────────────────────────────────────────
export type PlayerDetail = PlayerRow & {
  hand: string | null
  age: number | null
  joined: string
  email: string
  phone: string | null
  wins: number
  losses: number
  wo: number
  streak: ('W' | 'L')[]
  history: MatchEntry[]
}

export type MatchEntry = {
  vsName: string
  result: 'W' | 'L' | '—'
  score: string
  date: string
  role: 'challenger' | 'defender' | null
  posBefore: number | null
  posAfter: number | null
}

// ── Challenge activo ─────────────────────────────────────────────────────────
export type ActiveChallenge = {
  id: number
  challengerId: string
  challengedId: string
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
  dueAt: Date
  createdAt: string
  notes: string | null
}

// ── Aviso ────────────────────────────────────────────────────────────────────
export type Notice = {
  id: string
  icon: string
  text: string
  tone: 'court' | 'clay' | 'net'
}
