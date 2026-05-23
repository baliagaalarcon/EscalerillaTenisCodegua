-- ============================================================
-- ESCALERILLA CLUB DE TENIS CODEGUA
-- Esquema de Base de Datos (PostgreSQL / Supabase)
-- ============================================================
-- Notas de diseño:
--   • "usuarios" extiende la tabla auth.users de Supabase (auth_id).
--   • El ranking se almacena en dos partes: "ranking" (estado actual)
--     e "historial_ranking" (registro inmutable de cada cambio).
--   • Los grupos de color son configurables por temporada.
--   • Las funciones implementan toda la lógica de negocio de las
--     reglas: elegibilidad de desafíos, cascade de posiciones,
--     sanciones y congelamientos.
-- ============================================================


-- ============================================================
-- 1. USUARIOS
-- ============================================================
-- Extiende auth.users de Supabase. Un usuario puede ser
-- jugador normal o pertenecer a la directiva/admin.
-- El estado "congelado" corresponde a la regla 16 (lesión u
-- otra causa justificada).
-- ============================================================
CREATE TABLE usuarios (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id                     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre                      TEXT NOT NULL,
    apellido                    TEXT NOT NULL,
    email                       TEXT UNIQUE NOT NULL,
    telefono                    TEXT,
    foto_url                    TEXT,                   -- URL en Supabase Storage
    numero_socio                TEXT UNIQUE,
    rol                         TEXT NOT NULL DEFAULT 'jugador'
                                    CHECK (rol IN ('jugador', 'directiva', 'admin')),
    estado                      TEXT NOT NULL DEFAULT 'activo'
                                    CHECK (estado IN ('activo', 'inactivo', 'suspendido', 'congelado')),
    cuotas_al_dia               BOOLEAN NOT NULL DEFAULT TRUE,  -- regla 15
    posicion_congelamiento      INT,     -- guarda posición antes del congelamiento (regla 16)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  usuarios IS 'Perfiles de socios del club. Extiende auth.users de Supabase.';
COMMENT ON COLUMN usuarios.posicion_congelamiento IS 'Posición que tenía el jugador cuando se congeló (regla 16). Permite desafiar a quien ocupe esa posición al regresar.';


-- ============================================================
-- 2. TEMPORADAS
-- ============================================================
-- Cada "escalerilla" corre dentro de una temporada.
-- Los playoffs comienzan fecha_inicio_playoffs (regla 19).
-- A partir de esa fecha no se permiten cancelaciones mutuas
-- (regla 12: "hasta un mes antes del inicio de los Play-offs").
-- ============================================================
CREATE TABLE temporadas (
    id                      SERIAL PRIMARY KEY,
    nombre                  TEXT NOT NULL,          -- ej: "Escalerilla 2025 - Primer Semestre"
    fecha_inicio            DATE NOT NULL,
    fecha_fin               DATE NOT NULL,
    fecha_inicio_playoffs   DATE,                   -- regla 19
    estado                  TEXT NOT NULL DEFAULT 'activa'
                                CHECK (estado IN ('proxima', 'activa', 'playoffs', 'finalizada')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  temporadas IS 'Cada temporada representa una edición de la escalerilla.';
COMMENT ON COLUMN temporadas.fecha_inicio_playoffs IS 'Desde 1 mes antes de esta fecha no se permiten cancelaciones por mutuo acuerdo (regla 12).';


-- ============================================================
-- 3. GRUPOS DE COLOR
-- ============================================================
-- Los "cuadros de color" del ranking. Se configuran por temporada.
-- "orden" = 1 es el grupo más alto (posiciones 1..N del grupo).
-- Regla 1: solo se puede desafiar al mismo grupo o al grupo
-- inmediatamente superior (orden - 1). No dos grupos arriba.
-- ============================================================
CREATE TABLE grupos_color (
    id              SERIAL PRIMARY KEY,
    temporada_id    INT NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,          -- ej: "Oro", "Plata", "Grupo 1"
    color_hex       TEXT NOT NULL,          -- ej: "#A8D5A2" para mostrar en la UI
    posicion_desde  INT NOT NULL,           -- posición inicial del grupo (inclusivo)
    posicion_hasta  INT NOT NULL,           -- posición final del grupo (inclusivo)
    orden           INT NOT NULL,           -- 1 = el más alto en el ranking

    CONSTRAINT rango_valido CHECK (posicion_desde <= posicion_hasta),
    UNIQUE (temporada_id, orden)
);

COMMENT ON TABLE  grupos_color IS 'Define los cuadros de color del ranking para cada temporada.';
COMMENT ON COLUMN grupos_color.orden IS '1 = grupo más alto. Dos jugadores en grupos cuya diferencia de orden > 1 no pueden desafiarse (regla 1).';


-- ============================================================
-- 4. RANKING  (estado actual)
-- ============================================================
-- Una fila por jugador por temporada.
-- La columna "tendencia" alimenta las flechas de la UI
-- (↑ subió, ↓ bajó, → igual).
-- ============================================================
CREATE TABLE ranking (
    id                      SERIAL PRIMARY KEY,
    temporada_id            INT NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
    usuario_id              UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    posicion                INT NOT NULL,
    tendencia               TEXT NOT NULL DEFAULT 'igual'
                                CHECK (tendencia IN ('subio', 'bajo', 'igual')),
    ultima_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (temporada_id, usuario_id),
    UNIQUE (temporada_id, posicion)
);

COMMENT ON TABLE  ranking IS 'Posición actual de cada jugador en la temporada vigente.';
COMMENT ON COLUMN ranking.tendencia IS 'Dirección del último movimiento: alimenta las flechas de la UI.';


-- ============================================================
-- 5. HISTORIAL DE RANKING
-- ============================================================
-- Registro inmutable de cada cambio de posición.
-- Permite ver el historial completo de un jugador.
-- ============================================================
CREATE TABLE historial_ranking (
    id                  SERIAL PRIMARY KEY,
    temporada_id        INT NOT NULL REFERENCES temporadas(id),
    usuario_id          UUID NOT NULL REFERENCES usuarios(id),
    posicion_anterior   INT NOT NULL,
    posicion_nueva      INT NOT NULL,
    motivo              TEXT NOT NULL
                            CHECK (motivo IN (
                                'victoria_desafio',     -- ganó el desafío (regla 8)
                                'derrota_desafio',      -- perdió el desafío (regla 8, cascade)
                                'wo_ganado',            -- ganó por walkover (regla 7 / 11)
                                'wo_sancion',           -- sancionado con descenso por WO (regla 11)
                                'inactividad_mensual',  -- no jugó en el mes (regla 21)
                                'no_presentacion',      -- no se presentó el día del partido (regla 7.2)
                                'congelamiento',        -- jugador se congeló (regla 16)
                                'descongelamiento',     -- jugador regresó de congelamiento
                                'retiro',               -- jugador se retiró (regla 18)
                                'ajuste_manual'         -- corrección por un administrador
                            )),
    partido_id          INT,            -- FK a partidos (se define más abajo)
    sancion_id          INT,            -- FK a sanciones (se define más abajo)
    creado_por          UUID REFERENCES usuarios(id),   -- admin si fue manual
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE historial_ranking IS 'Registro inmutable de todos los movimientos de posición. Base del historial de cada jugador.';


-- ============================================================
-- 6. DESAFÍOS
-- ============================================================
-- Ciclo de vida completo de un desafío según las reglas:
--   pendiente → horario_propuesto → confirmado → jugado
--   (o anulado por timeout, WO, cancelación mutua)
--
-- Regla 10: desafiante tiene 24 hrs para notificar → estado 'nulo'
-- Regla 6:  desafiado tiene 24 hrs para proponer horario
--           desafiante tiene 24 hrs para confirmar
--           máximo 5 días para jugar antes de WO
-- ============================================================
CREATE TABLE desafios (
    id                              SERIAL PRIMARY KEY,
    temporada_id                    INT NOT NULL REFERENCES temporadas(id),
    desafiante_id                   UUID NOT NULL REFERENCES usuarios(id),
    desafiado_id                    UUID NOT NULL REFERENCES usuarios(id),

    -- Snapshot de posiciones en el momento del desafío
    posicion_desafiante_snapshot    INT NOT NULL,
    posicion_desafiado_snapshot     INT NOT NULL,

    estado  TEXT NOT NULL DEFAULT 'pendiente_registro'
                CHECK (estado IN (
                    'pendiente_registro',   -- creado por jugador, admin aún no validó (regla 3)
                    'activo',               -- validado por admin, esperando horario (regla 6)
                    'horario_propuesto',    -- desafiado propuso horarios disponibles
                    'confirmado',           -- acordaron fecha y hora, listo para jugar
                    'jugado',               -- partido terminado, resultado pendiente de carga
                    'cancelado_mutuo',      -- cancelado de mutuo acuerdo (regla 12)
                    'wo_desafiante',        -- desafiante no se presentó (regla 7.1/7.2)
                    'wo_desafiado',         -- desafiado no pudo jugar en 5 días (regla 7)
                    'nulo'                  -- desafiante no registró en 24 hrs (regla 10)
                )),

    -- Fechas límite según las reglas
    fecha_desafio               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_limite_registro       TIMESTAMPTZ,    -- +24 hrs para que el admin lo valide (regla 10)
    fecha_limite_horario        TIMESTAMPTZ,    -- +24 hrs para que desafiado proponga horario (regla 6)
    fecha_limite_confirmacion   TIMESTAMPTZ,    -- +24 hrs para que desafiante confirme (regla 6)
    fecha_limite_partido        TIMESTAMPTZ,    -- +5 días para jugar (regla 6/7)
    fecha_partido_acordada      TIMESTAMPTZ,    -- fecha/hora final acordada

    -- Horarios propuestos por el desafiado (array de timestamps)
    horarios_propuestos         TIMESTAMPTZ[],

    notas                       TEXT,
    validado_por                UUID REFERENCES usuarios(id),   -- admin que validó
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT no_autodesafio CHECK (desafiante_id != desafiado_id)
);

COMMENT ON TABLE  desafios IS 'Registro de cada desafío con su ciclo de vida completo.';
COMMENT ON COLUMN desafios.estado IS 'Ver reglas 3, 6, 7, 10, 12 para las transiciones de estado.';
COMMENT ON COLUMN desafios.posicion_desafiante_snapshot IS 'Snapshot de la posición al momento del desafío. Referencia histórica.';


-- ============================================================
-- 7. PARTIDOS
-- ============================================================
-- Resultado de un desafío. Cualquiera de los dos jugadores
-- puede reportar el resultado (regla 9/14). El otro confirma
-- o un admin resuelve si hay disputa.
-- Formato: mejor de 2 sets con tie break.
-- Si 1-1 en sets → super tie break a 10 puntos (regla 13).
-- ============================================================
CREATE TABLE partidos (
    id                  SERIAL PRIMARY KEY,
    desafio_id          INT NOT NULL UNIQUE REFERENCES desafios(id),
    ganador_id          UUID REFERENCES usuarios(id),
    perdedor_id         UUID REFERENCES usuarios(id),

    -- Resultado set 1
    set1_ganador        INT CHECK (set1_ganador BETWEEN 0 AND 7),
    set1_perdedor       INT CHECK (set1_perdedor BETWEEN 0 AND 7),

    -- Resultado set 2
    set2_ganador        INT CHECK (set2_ganador BETWEEN 0 AND 7),
    set2_perdedor       INT CHECK (set2_perdedor BETWEEN 0 AND 7),

    -- Super tie break (solo si 1-1 en sets, regla 13)
    stb_ganador         INT,    -- puntos del ganador en super tie break
    stb_perdedor        INT,    -- puntos del perdedor en super tie break

    es_wo               BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_jugado        TIMESTAMPTZ,

    -- Flujo de confirmación (regla 9 / 14)
    reportado_por       UUID REFERENCES usuarios(id),   -- quién cargó el resultado primero
    confirmado_por      UUID REFERENCES usuarios(id),   -- el otro jugador o un admin

    estado              TEXT NOT NULL DEFAULT 'pendiente_reporte'
                            CHECK (estado IN (
                                'pendiente_reporte',        -- partido jugado, nadie reportó aún
                                'pendiente_confirmacion',   -- un jugador reportó, espera confirmación
                                'confirmado',               -- confirmado, ranking actualizado
                                'disputado'                 -- los dos reportaron resultados distintos
                            )),
    ranking_actualizado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ganador_perdedor_distintos CHECK (ganador_id != perdedor_id),
    CONSTRAINT stb_requiere_empate CHECK (
        -- El super tie break solo aplica si los sets están 1-1
        (stb_ganador IS NULL) OR
        (stb_ganador IS NOT NULL AND stb_perdedor IS NOT NULL)
    )
);

-- FK diferida para historial_ranking → partidos
ALTER TABLE historial_ranking
    ADD CONSTRAINT fk_historial_partido FOREIGN KEY (partido_id) REFERENCES partidos(id);

COMMENT ON TABLE  partidos IS 'Resultado de cada desafío. El ranking se actualiza solo al pasar a estado confirmado.';
COMMENT ON COLUMN partidos.es_wo IS 'TRUE cuando el resultado es walkover, no se jugó el partido.';


-- ============================================================
-- 8. SANCIONES
-- ============================================================
-- Registro de todas las penalizaciones aplicables:
--   • WO (regla 11)
--   • Inactividad mensual (regla 21)
--   • No presentación el día del partido (regla 7.2)
--   • Conducta deportiva (regla 17)
--   • Expulsión (regla 17)
-- ============================================================
CREATE TABLE sanciones (
    id                  SERIAL PRIMARY KEY,
    usuario_id          UUID NOT NULL REFERENCES usuarios(id),
    temporada_id        INT REFERENCES temporadas(id),
    tipo                TEXT NOT NULL
                            CHECK (tipo IN (
                                'wo',                   -- walkover (regla 11)
                                'inactividad_mensual',  -- no jugó en el mes (regla 21)
                                'no_presentacion',      -- ausencia injustificada el día del partido (regla 7.2)
                                'conducta_deportiva',   -- falta durante el partido (regla 17)
                                'expulsion'             -- expulsión del club (regla 17)
                            )),
    gravedad            TEXT CHECK (gravedad IN ('leve', 'grave', 'muy_grave')),  -- solo para conducta_deportiva
    descripcion         TEXT,
    multa_monto         INT NOT NULL DEFAULT 0,         -- en pesos CLP
    multa_pagada        BOOLEAN NOT NULL DEFAULT FALSE,
    descenso_posiciones INT NOT NULL DEFAULT 0,         -- cuántas posiciones baja
    mes_referencia      DATE,       -- primer día del mes al que aplica (para inactividad/WO)
    aplicada            BOOLEAN NOT NULL DEFAULT FALSE, -- si ya se ejecutó el descenso en ranking
    creado_por          UUID REFERENCES usuarios(id),   -- admin que aplicó
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferida para historial_ranking → sanciones
ALTER TABLE historial_ranking
    ADD CONSTRAINT fk_historial_sancion FOREIGN KEY (sancion_id) REFERENCES sanciones(id);

COMMENT ON TABLE  sanciones IS 'Registro de penalizaciones. El campo "aplicada" indica si el descenso ya se ejecutó en ranking.';
COMMENT ON COLUMN sanciones.mes_referencia IS 'Para regla 21 (inactividad) y 11 (WO): primer día del mes calendario de referencia.';


-- ============================================================
-- 9. NOTIFICACIONES
-- ============================================================
-- Notificaciones in-app. Se complementa con envío de email
-- y/o push notifications (PWA) desde Edge Functions de Supabase.
-- ============================================================
CREATE TABLE notificaciones (
    id                  SERIAL PRIMARY KEY,
    usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo                TEXT NOT NULL
                            CHECK (tipo IN (
                                'nuevo_desafio',            -- recibiste un desafío
                                'desafio_validado',         -- la comisión validó el desafío
                                'desafio_nulo',             -- desafío anulado por timeout (regla 10)
                                'horario_propuesto',        -- el desafiado propuso horarios
                                'horario_confirmado',       -- se acordó la fecha del partido
                                'desafio_cancelado',        -- cancelación mutua
                                'resultado_reportado',      -- tu rival reportó el resultado
                                'resultado_confirmado',     -- resultado confirmado, ranking actualizado
                                'resultado_disputado',      -- hay disputa en el resultado
                                'ranking_actualizado',      -- tu posición cambió
                                'sancion_aplicada',         -- se te aplicó una sanción
                                'multa_pendiente',          -- tienes una multa sin pagar
                                'recordatorio_inactividad', -- aviso de que el mes se acaba
                                'recordatorio_partido',     -- recordatorio del partido agendado
                                'wo_registrado'             -- se registró un WO contra ti
                            )),
    titulo              TEXT NOT NULL,
    mensaje             TEXT NOT NULL,
    leida               BOOLEAN NOT NULL DEFAULT FALSE,
    referencia_id       INT,            -- ID del desafío, partido o sanción relacionado
    referencia_tipo     TEXT CHECK (referencia_tipo IN ('desafio', 'partido', 'sancion')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notificaciones IS 'Notificaciones in-app. Las Edge Functions de Supabase también envían email y push (PWA) al insertar aquí.';


-- ============================================================
-- 10. SUSCRIPCIONES PUSH (PWA)
-- ============================================================
-- Almacena los tokens de Web Push para notificaciones nativas
-- en el teléfono (sin costo adicional).
-- ============================================================
CREATE TABLE push_subscriptions (
    id          SERIAL PRIMARY KEY,
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth_key    TEXT NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, endpoint)
);

COMMENT ON TABLE push_subscriptions IS 'Tokens Web Push para notificaciones PWA nativas en el teléfono del socio.';


-- ============================================================
-- ÍNDICES
-- ============================================================

-- Ranking: la consulta más frecuente es "dame todos en orden"
CREATE INDEX idx_ranking_temporada_posicion    ON ranking (temporada_id, posicion);
CREATE INDEX idx_ranking_usuario               ON ranking (usuario_id);

-- Desafíos activos por jugador (regla 2: solo 1 desafío activo)
CREATE INDEX idx_desafios_desafiante_estado    ON desafios (desafiante_id, estado);
CREATE INDEX idx_desafios_desafiado_estado     ON desafios (desafiado_id, estado);
CREATE INDEX idx_desafios_temporada_estado     ON desafios (temporada_id, estado);

-- Historial por jugador
CREATE INDEX idx_historial_usuario_temporada   ON historial_ranking (usuario_id, temporada_id);

-- Sanciones por jugador y mes
CREATE INDEX idx_sanciones_usuario_mes         ON sanciones (usuario_id, mes_referencia);

-- Notificaciones no leídas por usuario
CREATE INDEX idx_notificaciones_usuario_leida  ON notificaciones (usuario_id, leida);


-- ============================================================
-- VISTAS
-- ============================================================

-- V1: Ranking completo con info del jugador, grupo de color y
--     si tiene un desafío activo en curso.
CREATE OR REPLACE VIEW v_ranking_actual AS
SELECT
    r.posicion,
    r.tendencia,
    u.id                AS usuario_id,
    u.nombre,
    u.apellido,
    u.foto_url,
    u.estado            AS estado_jugador,
    u.cuotas_al_dia,
    gc.nombre           AS grupo_nombre,
    gc.color_hex        AS grupo_color,
    gc.orden            AS grupo_orden,
    -- TRUE si el jugador tiene algún desafío en curso
    EXISTS (
        SELECT 1 FROM desafios d
        WHERE (d.desafiante_id = u.id OR d.desafiado_id = u.id)
          AND d.temporada_id = r.temporada_id
          AND d.estado NOT IN ('jugado', 'cancelado_mutuo', 'wo_desafiante', 'wo_desafiado', 'nulo')
    )                   AS tiene_desafio_activo,
    r.temporada_id,
    r.ultima_actualizacion
FROM ranking r
JOIN usuarios u ON u.id = r.usuario_id
JOIN grupos_color gc
    ON gc.temporada_id = r.temporada_id
    AND r.posicion BETWEEN gc.posicion_desde AND gc.posicion_hasta
ORDER BY r.posicion;

COMMENT ON VIEW v_ranking_actual IS 'Vista principal del ranking: posición, jugador, grupo de color y estado de desafío activo.';


-- V2: Conteo de WOs por jugador por mes (para aplicar regla 11)
CREATE OR REPLACE VIEW v_wo_por_mes AS
SELECT
    usuario_id,
    DATE_TRUNC('month', created_at)::DATE   AS mes,
    COUNT(*)                                AS cantidad_wo
FROM sanciones
WHERE tipo = 'wo'
GROUP BY usuario_id, DATE_TRUNC('month', created_at);

COMMENT ON VIEW v_wo_por_mes IS 'Conteo de WOs por jugador por mes. Más de 1 en el mismo mes activa sanción (regla 11).';


-- V3: Historial de partidos de un jugador con resultado y
--     movimiento de posición asociado.
CREATE OR REPLACE VIEW v_historial_partidos AS
SELECT
    p.id                AS partido_id,
    p.fecha_jugado,
    p.es_wo,
    p.set1_ganador,
    p.set1_perdedor,
    p.set2_ganador,
    p.set2_perdedor,
    p.stb_ganador,
    p.stb_perdedor,
    d.desafiante_id,
    d.desafiado_id,
    ug.nombre           AS nombre_ganador,
    ug.apellido         AS apellido_ganador,
    up.nombre           AS nombre_perdedor,
    up.apellido         AS apellido_perdedor,
    p.ganador_id,
    p.perdedor_id,
    d.temporada_id
FROM partidos p
JOIN desafios d ON p.desafio_id = d.id
LEFT JOIN usuarios ug ON ug.id = p.ganador_id
LEFT JOIN usuarios up ON up.id = p.perdedor_id
WHERE p.estado = 'confirmado'
ORDER BY p.fecha_jugado DESC;

COMMENT ON VIEW v_historial_partidos IS 'Historial de partidos confirmados con nombres de los jugadores.';


-- ============================================================
-- FUNCIONES
-- ============================================================

-- F1: Verificar si un desafío es válido
-- Retorna (puede BOOLEAN, razon TEXT)
-- Valida: dirección, grupo de color, un solo desafío activo,
--         cuotas al día, estado del jugador.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_desafiar(
    p_desafiante_id UUID,
    p_desafiado_id  UUID,
    p_temporada_id  INT
)
RETURNS TABLE (puede BOOLEAN, razon TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_pos_desafiante    INT;
    v_pos_desafiado     INT;
    v_orden_desafiante  INT;
    v_orden_desafiado   INT;
    v_tiene_activo_d1   BOOLEAN;
    v_tiene_activo_d2   BOOLEAN;
    v_cuotas            BOOLEAN;
    v_estado            TEXT;
BEGIN
    -- Obtener posiciones actuales
    SELECT posicion INTO v_pos_desafiante
    FROM ranking WHERE usuario_id = p_desafiante_id AND temporada_id = p_temporada_id;

    SELECT posicion INTO v_pos_desafiado
    FROM ranking WHERE usuario_id = p_desafiado_id AND temporada_id = p_temporada_id;

    IF v_pos_desafiante IS NULL OR v_pos_desafiado IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Uno de los jugadores no está en la temporada activa';
        RETURN;
    END IF;

    -- Regla 1: solo se puede desafiar hacia arriba (posición menor = más arriba)
    IF v_pos_desafiado >= v_pos_desafiante THEN
        RETURN QUERY SELECT FALSE, 'Solo puedes desafiar a jugadores en una posición superior';
        RETURN;
    END IF;

    -- Regla 1: verificar grupos de color (máximo 1 grupo arriba)
    SELECT orden INTO v_orden_desafiante
    FROM grupos_color
    WHERE temporada_id = p_temporada_id
      AND v_pos_desafiante BETWEEN posicion_desde AND posicion_hasta;

    SELECT orden INTO v_orden_desafiado
    FROM grupos_color
    WHERE temporada_id = p_temporada_id
      AND v_pos_desafiado BETWEEN posicion_desde AND posicion_hasta;

    -- orden más bajo = grupo más alto en el ranking
    -- Si la diferencia > 1, el desafiado está dos o más grupos arriba → no permitido
    IF (v_orden_desafiante - v_orden_desafiado) > 1 THEN
        RETURN QUERY SELECT FALSE, 'No puedes desafiar a jugadores que estén dos cuadros de color por encima';
        RETURN;
    END IF;

    -- Regla 2: el desafiante no puede tener un desafío activo
    SELECT EXISTS (
        SELECT 1 FROM desafios
        WHERE (desafiante_id = p_desafiante_id OR desafiado_id = p_desafiante_id)
          AND temporada_id = p_temporada_id
          AND estado NOT IN ('jugado', 'cancelado_mutuo', 'wo_desafiante', 'wo_desafiado', 'nulo')
    ) INTO v_tiene_activo_d1;

    IF v_tiene_activo_d1 THEN
        RETURN QUERY SELECT FALSE, 'Ya tienes un desafío activo en curso';
        RETURN;
    END IF;

    -- Regla 2: el desafiado tampoco puede tener un desafío activo
    SELECT EXISTS (
        SELECT 1 FROM desafios
        WHERE (desafiante_id = p_desafiado_id OR desafiado_id = p_desafiado_id)
          AND temporada_id = p_temporada_id
          AND estado NOT IN ('jugado', 'cancelado_mutuo', 'wo_desafiante', 'wo_desafiado', 'nulo')
    ) INTO v_tiene_activo_d2;

    IF v_tiene_activo_d2 THEN
        RETURN QUERY SELECT FALSE, 'El jugador desafiado ya tiene un desafío activo';
        RETURN;
    END IF;

    -- Regla 15: desafiante debe estar al día en cuotas
    SELECT cuotas_al_dia, estado INTO v_cuotas, v_estado
    FROM usuarios WHERE id = p_desafiante_id;

    IF NOT v_cuotas THEN
        RETURN QUERY SELECT FALSE, 'Debes estar al día en el pago de cuotas para realizar un desafío';
        RETURN;
    END IF;

    IF v_estado = 'suspendido' THEN
        RETURN QUERY SELECT FALSE, 'Tu cuenta está suspendida';
        RETURN;
    END IF;

    IF v_estado = 'congelado' THEN
        RETURN QUERY SELECT FALSE, 'Tu participación está congelada';
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Desafío válido';
END;
$$;

COMMENT ON FUNCTION fn_puede_desafiar IS 'Valida si un desafío es legal según las reglas 1, 2, 15. Usar antes de insertar en desafios.';


-- F2: Actualizar ranking cuando gana el DESAFIANTE (regla 8)
-- El desafiante sube a la posición del desafiado.
-- Todos los jugadores entre ambas posiciones bajan 1 lugar.
-- Si gana el desafiado, no se toca nada (regla 9).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_aplicar_resultado_partido(
    p_partido_id INT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_desafiante_id     UUID;
    v_desafiado_id      UUID;
    v_ganador_id        UUID;
    v_temporada_id      INT;
    v_pos_desafiante    INT;
    v_pos_desafiado     INT;
    v_es_wo             BOOLEAN;
BEGIN
    -- Obtener datos del partido y desafío
    SELECT
        d.desafiante_id,
        d.desafiado_id,
        d.temporada_id,
        p.ganador_id,
        p.es_wo
    INTO v_desafiante_id, v_desafiado_id, v_temporada_id, v_ganador_id, v_es_wo
    FROM partidos p
    JOIN desafios d ON p.desafio_id = d.id
    WHERE p.id = p_partido_id;

    -- Solo actuar si el ganador es el desafiante (regla 8/9)
    IF v_ganador_id != v_desafiante_id THEN
        -- El desafiado ganó: ranking no cambia (regla 9)
        UPDATE partidos SET ranking_actualizado = TRUE, updated_at = NOW()
        WHERE id = p_partido_id;
        RETURN;
    END IF;

    -- Obtener posiciones actuales
    SELECT posicion INTO v_pos_desafiante
    FROM ranking WHERE usuario_id = v_desafiante_id AND temporada_id = v_temporada_id;

    SELECT posicion INTO v_pos_desafiado
    FROM ranking WHERE usuario_id = v_desafiado_id AND temporada_id = v_temporada_id;

    -- Guardar historial de todos los jugadores afectados por el cascade
    INSERT INTO historial_ranking (temporada_id, usuario_id, posicion_anterior, posicion_nueva, motivo, partido_id)
    SELECT
        v_temporada_id,
        usuario_id,
        posicion,
        posicion + 1,
        'derrota_desafio',
        p_partido_id
    FROM ranking
    WHERE temporada_id = v_temporada_id
      AND posicion >= v_pos_desafiado
      AND posicion < v_pos_desafiante
      AND usuario_id != v_desafiante_id;

    -- Historial del desafiante (ganador)
    INSERT INTO historial_ranking (temporada_id, usuario_id, posicion_anterior, posicion_nueva, motivo, partido_id)
    VALUES (v_temporada_id, v_desafiante_id, v_pos_desafiante, v_pos_desafiado, 'victoria_desafio', p_partido_id);

    -- Cascade: todos entre la posición del desafiado y el desafiante bajan 1
    UPDATE ranking
    SET posicion = posicion + 1,
        tendencia = 'bajo',
        ultima_actualizacion = NOW()
    WHERE temporada_id = v_temporada_id
      AND posicion >= v_pos_desafiado
      AND posicion < v_pos_desafiante
      AND usuario_id != v_desafiante_id;

    -- El desafiante sube a la posición del desafiado
    UPDATE ranking
    SET posicion = v_pos_desafiado,
        tendencia = 'subio',
        ultima_actualizacion = NOW()
    WHERE temporada_id = v_temporada_id
      AND usuario_id = v_desafiante_id;

    -- Marcar partido como procesado
    UPDATE partidos
    SET ranking_actualizado = TRUE, updated_at = NOW()
    WHERE id = p_partido_id;

    -- Actualizar estado del desafío a jugado
    UPDATE desafios SET estado = 'jugado', updated_at = NOW()
    WHERE id = (SELECT desafio_id FROM partidos WHERE id = p_partido_id);

END;
$$;

COMMENT ON FUNCTION fn_aplicar_resultado_partido IS 'Aplica el resultado de un partido al ranking. Si gana el desafiante: cascade (regla 8). Si gana el desafiado: no cambia nada (regla 9).';


-- F3: Congelar un jugador (regla 16)
-- Guarda su posición actual, lo manda al último lugar.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_congelar_jugador(
    p_usuario_id    UUID,
    p_temporada_id  INT,
    p_admin_id      UUID
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_posicion_actual   INT;
    v_ultima_posicion   INT;
BEGIN
    SELECT posicion INTO v_posicion_actual
    FROM ranking WHERE usuario_id = p_usuario_id AND temporada_id = p_temporada_id;

    SELECT MAX(posicion) INTO v_ultima_posicion
    FROM ranking WHERE temporada_id = p_temporada_id;

    -- Guardar posición para recuperar al descongelarse
    UPDATE usuarios
    SET posicion_congelamiento = v_posicion_actual, estado = 'congelado', updated_at = NOW()
    WHERE id = p_usuario_id;

    -- Liberar su posición: todos por debajo suben 1
    UPDATE ranking
    SET posicion = posicion - 1, tendencia = 'subio', ultima_actualizacion = NOW()
    WHERE temporada_id = p_temporada_id AND posicion > v_posicion_actual;

    -- Mandarlo al final
    UPDATE ranking
    SET posicion = v_ultima_posicion, tendencia = 'bajo', ultima_actualizacion = NOW()
    WHERE usuario_id = p_usuario_id AND temporada_id = p_temporada_id;

    -- Historial
    INSERT INTO historial_ranking (temporada_id, usuario_id, posicion_anterior, posicion_nueva, motivo, creado_por)
    VALUES (p_temporada_id, p_usuario_id, v_posicion_actual, v_ultima_posicion, 'congelamiento', p_admin_id);
END;
$$;

COMMENT ON FUNCTION fn_congelar_jugador IS 'Congela a un jugador por lesión u otra causa (regla 16). Guarda su posición y lo manda al final.';


-- F4: Aplicar sanción de descenso de posiciones
-- Usada para WO reincidente (regla 11), inactividad (regla 21),
-- no presentación (regla 7.2).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_aplicar_sancion_descenso(
    p_sancion_id INT
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_usuario_id        UUID;
    v_temporada_id      INT;
    v_descenso          INT;
    v_pos_actual        INT;
    v_pos_nueva         INT;
    v_ultima_pos        INT;
BEGIN
    SELECT usuario_id, temporada_id, descenso_posiciones
    INTO v_usuario_id, v_temporada_id, v_descenso
    FROM sanciones WHERE id = p_sancion_id;

    SELECT posicion INTO v_pos_actual
    FROM ranking WHERE usuario_id = v_usuario_id AND temporada_id = v_temporada_id;

    SELECT MAX(posicion) INTO v_ultima_pos
    FROM ranking WHERE temporada_id = v_temporada_id;

    -- Si descenso = 0, mandar al último lugar directamente
    IF v_descenso = 0 THEN
        v_pos_nueva := v_ultima_pos;
    ELSE
        v_pos_nueva := LEAST(v_pos_actual + v_descenso, v_ultima_pos);
    END IF;

    -- Ajustar posiciones intermedias
    UPDATE ranking
    SET posicion = posicion - 1, ultima_actualizacion = NOW()
    WHERE temporada_id = v_temporada_id
      AND posicion > v_pos_actual
      AND posicion <= v_pos_nueva
      AND usuario_id != v_usuario_id;

    -- Mover al jugador sancionado
    UPDATE ranking
    SET posicion = v_pos_nueva, tendencia = 'bajo', ultima_actualizacion = NOW()
    WHERE usuario_id = v_usuario_id AND temporada_id = v_temporada_id;

    -- Marcar sanción como aplicada
    UPDATE sanciones SET aplicada = TRUE WHERE id = p_sancion_id;

    -- Historial
    INSERT INTO historial_ranking (temporada_id, usuario_id, posicion_anterior, posicion_nueva, motivo, sancion_id)
    VALUES (v_temporada_id, v_usuario_id, v_pos_actual, v_pos_nueva,
            (SELECT tipo FROM sanciones WHERE id = p_sancion_id), p_sancion_id);
END;
$$;

COMMENT ON FUNCTION fn_aplicar_sancion_descenso IS 'Ejecuta el descenso de posiciones asociado a una sanción. Si descenso_posiciones = 0 se manda al último lugar.';


-- ============================================================
-- TRIGGER: actualizar ranking automáticamente al confirmar
--          el resultado de un partido.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_partido_confirmado()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = 'confirmado' AND OLD.estado != 'confirmado' AND NOT NEW.ranking_actualizado THEN
        PERFORM fn_aplicar_resultado_partido(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_partido_confirmado
    AFTER UPDATE ON partidos
    FOR EACH ROW
    EXECUTE FUNCTION trg_partido_confirmado();

COMMENT ON TRIGGER trigger_partido_confirmado ON partidos IS 'Aplica el resultado al ranking automáticamente cuando el partido pasa a estado confirmado.';


-- ============================================================
-- DATOS DE REFERENCIA: grupos de color para temporada inicial
-- (basado en el ranking actual de 65 jugadores, imagen adjunta)
-- Ajustar posicion_desde/posicion_hasta según la temporada real.
-- ============================================================
-- Estos son los grupos aproximados visibles en la imagen:
-- INSERT INTO grupos_color (temporada_id, nombre, color_hex, posicion_desde, posicion_hasta, orden)
-- VALUES
--     (1, 'Grupo 1',  '#A8D5A2',  1,  4,  1),  -- verde claro
--     (1, 'Grupo 2',  '#F4A896',  5,  9,  2),  -- salmón
--     (1, 'Grupo 3',  '#A8C8E8', 10, 16,  3),  -- azul claro
--     (1, 'Grupo 4',  '#C8B4D8', 17, 23,  4),  -- lavanda
--     (1, 'Grupo 5',  '#F5E6A0', 24, 30,  5),  -- amarillo
--     (1, 'Grupo 6',  '#F4B8C8', 31, 37,  6),  -- rosado
--     (1, 'Grupo 7',  '#F5F0A0', 38, 43,  7),  -- amarillo claro
--     (1, 'Grupo 8',  '#A8D8E8', 44, 50,  8),  -- celeste
--     (1, 'Grupo 9',  '#B8E8B0', 51, 57,  9),  -- verde menta
--     (1, 'Grupo 10', '#F4C8A8', 58, 64, 10),  -- durazno
--     (1, 'Grupo 11', '#E84040', 65, 65, 11);  -- rojo (último)


-- ============================================================
-- ROW LEVEL SECURITY (RLS) — políticas esenciales para Supabase
-- ============================================================
-- Activar RLS en todas las tablas
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_ranking   ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver el ranking (público)
CREATE POLICY "ranking_publico" ON ranking
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "grupos_color_publico" ON grupos_color
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "temporadas_publico" ON temporadas
    FOR SELECT TO authenticated USING (TRUE);

-- Los usuarios pueden ver todos los perfiles, pero solo editar el suyo
CREATE POLICY "usuarios_select_publico" ON usuarios
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "usuarios_update_propio" ON usuarios
    FOR UPDATE TO authenticated
    USING (auth.uid() = auth_id);

-- Cada usuario ve solo sus propias notificaciones
CREATE POLICY "notificaciones_propias" ON notificaciones
    FOR SELECT TO authenticated
    USING (usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid()));

-- Desafíos: visibles para todos (para ver quién tiene desafíos activos)
CREATE POLICY "desafios_select_publico" ON desafios
    FOR SELECT TO authenticated USING (TRUE);

-- Solo los involucrados o admins pueden insertar desafíos
-- (lógica más detallada se implementa en la capa de aplicación)
CREATE POLICY "partidos_select_publico" ON partidos
    FOR SELECT TO authenticated USING (TRUE);

-- Historial visible para todos
CREATE POLICY "historial_select_publico" ON historial_ranking
    FOR SELECT TO authenticated USING (TRUE);

-- Sanciones: solo directiva/admin pueden ver y crear
-- (se refina con un helper function is_admin())
CREATE POLICY "sanciones_solo_admin" ON sanciones
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol IN ('directiva','admin'))
    );
