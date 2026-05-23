// API Route: Confirmar o rechazar el resultado de un partido
// POST /api/desafios/confirmar
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { partido_id, accion } = await request.json()
  // accion: 'confirmar' | 'disputar'

  if (!partido_id || !['confirmar', 'disputar'].includes(accion)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  // Obtener datos del usuario actual
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol')
    .eq('auth_id', user.id)
    .single()

  // Obtener partido
  const { data: partido } = await supabase
    .from('partidos')
    .select('*, desafio:desafio_id(desafiante_id, desafiado_id)')
    .eq('id', partido_id)
    .single()

  if (!partido) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  // Solo puede confirmar quien NO reportó (el otro jugador) o un admin
  const esAdmin = ['directiva', 'admin'].includes(usuario?.rol ?? '')
  const esRival = partido.ganador_id === usuario?.id || partido.perdedor_id === usuario?.id
  const yaReporto = partido.reportado_por === usuario?.id

  if (!esAdmin && (!esRival || yaReporto)) {
    return NextResponse.json({ error: 'No tienes permisos para confirmar este resultado' }, { status: 403 })
  }

  if (accion === 'confirmar') {
    // Confirmar → el trigger actualizará el ranking automáticamente
    const { error } = await adminSupabase
      .from('partidos')
      .update({
        estado: 'confirmado',
        confirmado_por: usuario?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al confirmar' }, { status: 500 })
    }
  } else {
    // Disputar → requiere resolución manual del admin
    const { error } = await adminSupabase
      .from('partidos')
      .update({ estado: 'disputado', updated_at: new Date().toISOString() })
      .eq('id', partido_id)

    if (error) {
      return NextResponse.json({ error: 'Error al disputar' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
