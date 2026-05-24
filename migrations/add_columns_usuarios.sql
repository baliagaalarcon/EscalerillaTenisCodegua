-- Migración: Agregar columnas necesarias para la nueva interfaz
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Fecha: 2026-05-24

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mano text DEFAULT 'Diestro'
    CHECK (mano IN ('Diestro', 'Zurdo')),
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
  ADD COLUMN IF NOT EXISTS motivo_pausa text,
  ADD COLUMN IF NOT EXISTS grupo_congelamiento int;

-- Verificar resultado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('mano', 'fecha_nacimiento', 'motivo_pausa', 'grupo_congelamiento')
ORDER BY column_name;
