// Utilidades para lógica de negocio del ranking

import type { EstadoDesafio, TendenciaRanking } from '@/lib/types/database.types'

// Devuelve el emoji/ícono de tendencia para la UI
export function iconoTendencia(tendencia: TendenciaRanking): string {
  switch (tendencia) {
    case 'subio': return '↑'
    case 'bajo':  return '↓'
    default:      return '→'
  }
}

// Formatea el resultado de un partido para mostrarlo como "6-4, 7-5"
export function formatearResultado(
  set1G: number | null, set1P: number | null,
  set2G: number | null, set2P: number | null,
  stbG: number | null,  stbP: number | null
): string {
  if (set1G === null) return '—'
  const sets = [`${set1G}-${set1P}`, `${set2G}-${set2P}`]
  if (stbG !== null) sets.push(`(${stbG}-${stbP})`)
  return sets.join(', ')
}

// Verifica si un desafío está en un estado "activo" (en curso)
export function esDesafioActivo(estado: EstadoDesafio): boolean {
  return ![
    'jugado', 'cancelado_mutuo', 'wo_desafiante', 'wo_desafiado', 'nulo'
  ].includes(estado)
}

// Texto amigable para cada estado de desafío
export function labelEstadoDesafio(estado: EstadoDesafio): string {
  const labels: Record<EstadoDesafio, string> = {
    pendiente_registro:  'Pendiente de registro',
    activo:              'Esperando horario',
    horario_propuesto:   'Horario propuesto',
    confirmado:          'Partido agendado',
    jugado:              'Jugado',
    cancelado_mutuo:     'Cancelado (mutuo acuerdo)',
    wo_desafiante:       'W.O. — Desafiante',
    wo_desafiado:        'W.O. — Desafiado',
    nulo:                'Nulo (no registrado a tiempo)',
  }
  return labels[estado] ?? estado
}

// Determina el color del badge de estado para la UI (clases Tailwind)
export function colorEstadoDesafio(estado: EstadoDesafio): string {
  if (['confirmado'].includes(estado))            return 'bg-green-100 text-green-800'
  if (['activo', 'horario_propuesto'].includes(estado)) return 'bg-blue-100 text-blue-800'
  if (['wo_desafiante', 'wo_desafiado'].includes(estado)) return 'bg-red-100 text-red-800'
  if (['nulo', 'cancelado_mutuo'].includes(estado)) return 'bg-gray-100 text-gray-600'
  return 'bg-yellow-100 text-yellow-800'
}

// Meses excluidos de la regla de actividad mínima (regla 21)
export const MESES_VACACIONES = [1, 2] // enero y febrero

export function esMesVacaciones(fecha: Date): boolean {
  return MESES_VACACIONES.includes(fecha.getMonth() + 1)
}
