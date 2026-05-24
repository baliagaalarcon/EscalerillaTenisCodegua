// Formulario para crear un nuevo desafío
// Muestra solo los jugadores que el usuario PUEDE desafiar (reglas 1, 2, 15)
import { createClient } from '@/lib/supabase/server'
import NuevoDesafioForm from '@/components/desafios/NuevoDesafioForm'

export const metadata = { title: 'Nuevo Desafío — Escalerilla Codegua' }

export default async function NuevoDesafioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuarioActual } = await supabase
    .from('usuarios')
    .select('id, cuotas_al_dia, estado')
    .eq('auth_id', user!.id)
    .single()

  // Temporada activa
  const { data: temporada } = await supabase
    .from('temporadas')
    .select('id')
    .eq('estado', 'activa')
    .single()

  // Ranking completo con grupo de color y estado de desafío
  const { data: rankingCompleto } = await supabase
    .from('v_ranking_actual')
    .select('*')
    .eq('temporada_id', temporada?.id ?? 0)
    .order('posicion', { ascending: true })

  // Mi posición y grupo
  const yoEnRanking = rankingCompleto?.find(r => r.usuario_id === usuarioActual?.id)

  // Filtrar jugadores desafiables usando la función SQL
  // Llamar fn_puede_desafiar() para cada candidato sería ineficiente;
  // en su lugar aplicamos las reglas en el cliente con los datos ya cargados.
  const miGrupoOrden = yoEnRanking?.grupo_orden ?? 999
  const miPosicion = yoEnRanking?.posicion ?? 999

  const jugablesRaw = rankingCompleto?.filter(j => {
    // Debe estar por encima (posición menor)
    if (j.posicion >= miPosicion) return false
    // No puede tener desafío activo
    if (j.tiene_desafio_activo) return false
    // Mismo grupo o un grupo arriba (orden más bajo)
    if ((miGrupoOrden - j.grupo_orden) > 1) return false
    return true
  }) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Nuevo Desafío</h1>
      <p className="text-sm text-gray-500 mb-6">
        Puedes desafiar a jugadores de tu mismo grupo de color o del grupo inmediatamente superior.
      </p>

      {!usuarioActual?.cuotas_al_dia && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
          ⚠️ Tienes cuotas pendientes. Debes regularizar tu situación antes de desafiar (regla 15).
        </div>
      )}

      <NuevoDesafioForm
        desafianteId={usuarioActual?.id ?? ''}
        temporadaId={temporada?.id ?? 0}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jugadoresElegibles={jugablesRaw as any[]}
        habilitado={
          usuarioActual?.cuotas_al_dia === true &&
          usuarioActual?.estado === 'activo' &&
          !yoEnRanking?.tiene_desafio_activo
        }
      />
    </div>
  )
}
