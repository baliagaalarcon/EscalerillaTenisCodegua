# Guía de Instalación y Configuración
## Escalerilla Club de Tenis Codegua

---

## 1. Prerrequisitos

- Node.js 18 o superior → https://nodejs.org
- Cuenta en Supabase → https://supabase.com (gratis)
- Cuenta en Vercel → https://vercel.com (gratis)
- Git → https://git-scm.com

---

## 2. Configurar Supabase

### 2.1 Crear el proyecto
1. Entra a https://supabase.com → "New Project"
2. Nombre: `escalerilla-codegua`
3. Anota la contraseña de la base de datos (la necesitarás después)
4. Región: South America (São Paulo) → más rápido desde Chile

### 2.2 Ejecutar el schema
1. En Supabase Dashboard → "SQL Editor"
2. Pega el contenido completo de `schema.sql` y ejecuta
3. Verifica que se crearon las tablas en "Table Editor"

### 2.3 Configurar Storage (fotos de perfil)
1. Supabase Dashboard → "Storage" → "New bucket"
2. Nombre: `avatars`
3. Public bucket: ✅ activado
4. En "Policies", añade:
   - SELECT: `true` (cualquiera puede ver fotos)
   - INSERT/UPDATE: `auth.uid() IS NOT NULL` (solo autenticados pueden subir)

### 2.4 Insertar datos iniciales
```sql
-- 1. Crear la temporada actual
INSERT INTO temporadas (nombre, fecha_inicio, fecha_fin, fecha_inicio_playoffs, estado)
VALUES ('Escalerilla 2025 - Primer Semestre', '2025-03-01', '2025-07-31', '2025-07-01', 'activa');

-- 2. Insertar los grupos de color (ajusta los rangos a tu escalerilla)
INSERT INTO grupos_color (temporada_id, nombre, color_hex, posicion_desde, posicion_hasta, orden)
VALUES
    (1, 'Grupo 1',  '#A8D5A2',  1,  4,  1),
    (1, 'Grupo 2',  '#F4A896',  5,  9,  2),
    (1, 'Grupo 3',  '#A8C8E8', 10, 16,  3),
    (1, 'Grupo 4',  '#C8B4D8', 17, 23,  4),
    (1, 'Grupo 5',  '#F5E6A0', 24, 30,  5),
    (1, 'Grupo 6',  '#F4B8C8', 31, 37,  6),
    (1, 'Grupo 7',  '#F5F0A0', 38, 43,  7),
    (1, 'Grupo 8',  '#A8D8E8', 44, 50,  8),
    (1, 'Grupo 9',  '#B8E8B0', 51, 57,  9),
    (1, 'Grupo 10', '#F4C8A8', 58, 64, 10),
    (1, 'Grupo 11', '#E84040', 65, 65, 11);
```

### 2.5 Crear usuarios
Opción A (recomendada para empezar): desde el Dashboard de Supabase → Authentication → Users → "Invite user". Supabase envía email con link para que el jugador cree su contraseña.

Después de crear el auth, insertar en la tabla `usuarios`:
```sql
INSERT INTO usuarios (auth_id, nombre, apellido, email, numero_socio, rol)
VALUES (
    '(UUID que aparece en Authentication → Users)',
    'Sebastian', 'Villegas', 'sebastian@email.com', '001', 'jugador'
);

-- Y su posición inicial en el ranking:
INSERT INTO ranking (temporada_id, usuario_id, posicion)
VALUES (1, '(UUID del usuario)', 1);
```

---

## 3. Instalar y correr la app en local

```bash
# Clonar / entrar al directorio
cd "App Club Tenis"

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.local.example .env.local
# Editar .env.local con tus claves de Supabase

# Correr en desarrollo
npm run dev
```

Abre http://localhost:3000

---

## 4. Generar tipos TypeScript desde Supabase (opcional pero recomendado)

Cuando hagas cambios al schema, regenera los tipos para mantener TypeScript sincronizado:

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Generar tipos (reemplaza TU_PROJECT_ID con el ID de tu proyecto)
#npx supabase gen types typescript --project-id TU_PROJECT_ID > lib/types/database.types.ts
npx supabase gen types typescript --project-id tkpiexbaljmnfsadcdzi > lib/types/database.types.ts
```

---

## 5. Deploy en Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel Dashboard:
# Settings → Environment Variables
# Añadir todas las variables de .env.local.example
```

O conecta el repositorio GitHub directamente en vercel.com → "Import Project".

---

## 6. Estructura de archivos del proyecto

```
escalerilla-codegua/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          ← Página de login
│   ├── (app)/                      ← Rutas protegidas (jugadores)
│   │   ├── layout.tsx              ← Layout con NavBar
│   │   ├── ranking/page.tsx        ← Ranking principal ⭐
│   │   ├── desafios/
│   │   │   ├── page.tsx            ← Mis desafíos
│   │   │   ├── nuevo/page.tsx      ← Crear desafío ⭐
│   │   │   └── [id]/page.tsx       ← Detalle de desafío (pendiente)
│   │   ├── perfil/
│   │   │   └── [id]/page.tsx       ← Perfil público ⭐
│   │   └── notificaciones/page.tsx ← (pendiente)
│   ├── (admin)/                    ← Rutas solo directiva/admin
│   │   └── admin/
│   │       ├── layout.tsx          ← Sidebar admin
│   │       ├── page.tsx            ← Dashboard ⭐
│   │       ├── desafios/           ← (pendiente)
│   │       ├── jugadores/          ← (pendiente)
│   │       └── sanciones/          ← (pendiente)
│   └── api/
│       └── desafios/
│           └── confirmar/route.ts  ← API confirmar resultado
├── components/
│   ├── layout/NavBar.tsx           ← Navegación inferior
│   ├── ranking/RankingTable.tsx    ← Tabla del ranking ⭐
│   └── desafios/NuevoDesafioForm   ← Formulario desafío ⭐
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← Supabase (browser)
│   │   └── server.ts               ← Supabase (server)
│   ├── types/database.types.ts     ← Tipos TypeScript ⭐
│   └── utils/ranking.ts            ← Helpers de lógica
├── middleware.ts                   ← Auth + roles ⭐
├── schema.sql                      ← Base de datos completa ⭐
└── SETUP.md                        ← Esta guía
```

⭐ = Archivos más importantes para entender el proyecto

---

## 7. Próximos pasos sugeridos

1. **Detalle del desafío** (`app/(app)/desafios/[id]/page.tsx`): mostrar el estado actual, proponer/confirmar horarios, reportar resultado
2. **Reporte de resultado**: formulario para ingresar el marcador (sets, super tiebreak)
3. **Notificaciones**: usar Supabase Realtime para notificaciones en tiempo real + email via Resend
4. **PWA**: agregar service worker para notificaciones push nativas
5. **Panel admin completo**: gestión de jugadores, sanciones, ajustes manuales de ranking
6. **Página de perfil propio**: editar foto, teléfono, etc.

---

## Costo estimado mensual

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free (500MB DB, 1GB storage) | $0 |
| Vercel | Hobby | $0 |
| Dominio | .cl anual | ~$10-15/año |
| **Total** | | **~$10-15/año** |
