'use client'

import Link from 'next/link'
import { iconoTendencia } from '@/lib/utils/ranking'
import type { TendenciaRanking } from '@/lib/utils/ranking'

interface RankingJugador {
  usuario_id: string
  posicion: number
  nombre: string
  apellido: string
  foto_url: string | null
  grupo_nombre: string
  grupo_color: string
  tendencia: TendenciaRanking
  tiene_desafio_activo: boolean
  cuotas_al_dia: boolean
  estado_jugador: string | null
}

interface Props {
  jugadores: RankingJugador[]
  usuarioActualId: string
}

export default function RankingTable({ jugadores, usuarioActualId }: Props) {
  // Agrupar por grupo de color para mostrar el separador visual
  let grupoActual = ''

  return (
    <div className="space-y-0.5">
      {jugadores.map((j, i) => {
        const esGrupoNuevo = j.grupo_nombre !== grupoActual
        if (esGrupoNuevo) grupoActual = j.grupo_nombre
        const esMiPosicion = j.usuario_id === usuarioActualId

        return (
          <div key={j.usuario_id}>
            {/* Separador de grupo de color */}
            {esGrupoNuevo && i > 0 && (
              <div className="h-2" />
            )}

            <Link href={`/perfil/${j.usuario_id}`}>
              <div
                className={`ranking-row ${esMiPosicion ? 'ring-2 ring-sky-400 ring-inset' : ''}`}
                style={{ backgroundColor: `${j.grupo_color}22` }}
              >
                {/* Posición */}
                <div
                  className="posicion-badge shrink-0"
                  style={{ backgroundColor: j.grupo_color }}
                >
                  {j.posicion}
                </div>

                {/* Tendencia */}
                <span
                  className={`text-sm font-bold w-4 shrink-0 ${
                    j.tendencia === 'subio' ? 'text-green-600' :
                    j.tendencia === 'bajo'  ? 'text-red-500' :
                    'text-gray-400'
                  }`}
                >
                  {iconoTendencia(j.tendencia)}
                </span>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center
                                text-xs font-bold text-gray-600 shrink-0 overflow-hidden">
                  {j.foto_url ? (
                    <img src={j.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    `${j.nombre[0]}${j.apellido[0]}`
                  )}
                </div>

                {/* Nombre */}
                <span className={`flex-1 text-sm font-medium truncate
                                  ${esMiPosicion ? 'text-sky-700' : 'text-gray-900'}`}>
                  {j.nombre} {j.apellido}
                  {esMiPosicion && <span className="text-xs text-sky-400 ml-1">(tú)</span>}
                </span>

                {/* Estado */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {j.tiene_desafio_activo && (
                    <span title="Tiene un desafío activo" className="text-sm">⚔️</span>
                  )}
                  {!j.cuotas_al_dia && (
                    <span title="Cuotas pendientes" className="text-sm">⚠️</span>
                  )}
                  {j.estado_jugador === 'congelado' && (
                    <span title="Participación congelada" className="text-sm">🧊</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
