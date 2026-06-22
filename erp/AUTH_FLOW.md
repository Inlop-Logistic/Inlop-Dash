# INLOP ERP — Authentication & Authorization Flow

> **FASE 2 — Application Shell**  
> Rol: Arquitecto Frontend Senior  
> Estado: Documentación — sin código

---

## 1. Estrategia de Autenticación

El ERP INLOP usa una arquitectura de **doble identidad**:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| **Identidad corporativa** | Microsoft Azure AD (MSAL) | SSO empresarial, MFA, directorio de empleados |
| **Sesión de aplicación** | Supabase Auth | JWT de sesión, Row Level Security, permisos ERP |

### Por qué Doble Capa

1. **MSAL** provee identidad de confianza institucional. Los usuarios no crean contraseñas nuevas.
2. **Supabase** provee el mecanismo de sesión nativo del stack y habilita Row Level Security (RLS) en PostgreSQL.
3. Al unirlas: el token de Azure AD se intercambia por un JWT de Supabase. El usuario vive en Azure AD; los permisos ERP viven en Supabase.

---

## 2. Flujo de Login Completo

```
Usuario ingresa al ERP
       │
       ▼
[Middleware] ── ¿Tiene JWT de Supabase válido? ──→ SÍ ──→ Acceso al portal
       │
      NO
       │
       ▼
  Redirige a /login
       │
       ▼
[Página /login]
  Muestra botón "Iniciar sesión con Microsoft"
       │
       ▼
  Click → MSAL.loginRedirect()
       │
       ▼
  Redirige a Microsoft Identity Platform
  (login.microsoftonline.com)
       │
       ▼
  Usuario se autentica (credenciales + MFA si está configurado)
       │
       ▼
  Microsoft redirige a /callback?code=...&state=...
       │
       ▼
[Página /callback]
  MSAL intercambia code → access_token + id_token
       │
       ▼
  Se llama a Supabase Auth con el id_token de Azure
  (signInWithIdToken / custom JWT exchange)
       │
       ▼
  Supabase valida el token con las claves públicas de Azure AD
  Crea o actualiza el registro en auth.users
  Emite JWT de Supabase
       │
       ▼
  JWT se guarda en cookie HttpOnly (manejada por Supabase Auth Helpers)
       │
       ▼
  Redirige a returnUrl (si existe) o a /operaciones/resumen
       │
       ▼
  [Portal] Shell carga con sesión activa
```

---

## 3. Gestión de Tokens

### 3.1 Tokens en Juego

| Token | Origen | Almacenamiento | TTL | Uso |
|---|---|---|---|---|
| `access_token` Azure AD | MSAL | Memory (MSAL cache) | 1h | Llamadas a APIs de Microsoft (SharePoint, MS Graph) |
| `id_token` Azure AD | MSAL | Memory (MSAL cache) | 1h | Intercambio por JWT de Supabase |
| `refresh_token` Azure AD | MSAL | localStorage (MSAL) | 90 días | Renovar access_token sin re-login |
| `JWT` Supabase | Supabase | Cookie HttpOnly | 1h | Autenticación en todas las llamadas a Supabase y API Routes |
| `refresh_token` Supabase | Supabase | Cookie HttpOnly | 7 días | Renovar JWT de Supabase |

### 3.2 Renovación Automática de Sesión

- **Supabase**: El cliente Supabase detecta token próximo a expirar y lo renueva automáticamente con el refresh_token.
- **MSAL**: `acquireTokenSilent` se llama antes de cada llamada a Microsoft APIs. Si falla (refresh expirado): re-login.
- El usuario **nunca debe ver un prompt de login** durante una sesión activa normal.

### 3.3 Cookies vs localStorage

| Dato | Almacenamiento | Razón |
|---|---|---|
| JWT Supabase | Cookie HttpOnly | El middleware del servidor puede leerla; no accesible via JS |
| MSAL tokens | localStorage (MSAL) | MSAL SDK lo gestiona; estándar de la librería |
| Empresa activa | Cookie + localStorage | Cookie para SSR; localStorage como respaldo |
| Preferencias UI | localStorage | Solo relevantes en cliente |

---

## 4. Flujo de Logout

```
Usuario hace click en "Cerrar sesión"
       │
       ▼
  Llamada a POST /api/auth/logout
       │
       ├── Supabase: signOut() → invalida JWT y refresh token
       ├── MSAL: logoutRedirect() → invalida sesión en Microsoft
       └── Limpia cookies de sesión
       │
       ▼
  Redirige a /login
  (Microsoft también cierra la sesión SSO corporativa)
```

### Logout Parcial (solo ERP)

Para escenarios de soporte o cambio de cuenta, existe un logout solo de Supabase sin invalidar la sesión de Microsoft. El usuario puede re-autenticarse sin introducir credenciales nuevamente.

---

## 5. Roles del Sistema

### 5.1 Definición de Roles

| Rol | Descripción | Módulos accesibles |
|---|---|---|
| `superadmin` | Acceso total. Configura otros roles. | Todos + configuración |
| `admin` | Administrador de empresa. Gestiona usuarios de su empresa. | Todos |
| `operaciones` | Equipo de operaciones logísticas. | Operaciones, OTIF, Seguimiento, Planeación |
| `financiero` | Equipo financiero. | Financiero, Operaciones (read-only) |
| `juridico` | Equipo jurídico / cumplimiento. | Obligaciones, Proyecto |
| `proyecto` | Gestión de proyectos. | Proyecto, Operaciones (read-only) |
| `viewer` | Solo lectura en módulos asignados. | Según asignación explícita |

### 5.2 Jerarquía de Roles

```
superadmin
  └── admin
        ├── operaciones
        ├── financiero
        ├── juridico
        ├── proyecto
        └── viewer
```

Un rol no hereda permisos del rol padre automáticamente. La jerarquía es solo conceptual para la asignación. Los permisos se definen explícitamente por rol.

### 5.3 Multirol

Un usuario puede tener más de un rol simultáneamente:
- Ejemplo: `operaciones` + `proyecto` → accede a ambos módulos con sus permisos respectivos.
- Los permisos se suman (unión); no se restan.

---

## 6. Sistema de Permisos

### 6.1 Modelo de Permisos

Se usa un modelo **RBAC (Role-Based Access Control)** con granularidad a nivel de acción:

```
permiso = { rol, módulo, acción }

Ejemplo:
  { rol: 'operaciones', módulo: 'operaciones', acción: 'read' }     → TRUE
  { rol: 'operaciones', módulo: 'operaciones', acción: 'upload' }   → TRUE
  { rol: 'operaciones', módulo: 'financiero',  acción: 'read' }     → FALSE
  { rol: 'viewer',      módulo: 'operaciones', acción: 'read' }     → TRUE
  { rol: 'viewer',      módulo: 'operaciones', acción: 'upload' }   → FALSE
```

### 6.2 Acciones Estándar

| Acción | Descripción |
|---|---|
| `read` | Ver datos, dashboards, reportes |
| `create` | Crear registros, cargar archivos |
| `update` | Editar registros existentes |
| `delete` | Eliminar registros |
| `upload` | Cargar archivos Excel |
| `export` | Descargar reportes, exportar datos |
| `ai_analyze` | Usar análisis de IA (Claude) |
| `manage_users` | Gestionar usuarios de la empresa |
| `configure` | Cambiar configuraciones del módulo |

### 6.3 Matriz de Permisos por Rol

| Acción | superadmin | admin | operaciones | financiero | juridico | proyecto | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `read` (módulos asignados) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `update` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `delete` | ✓ | ✓ | — | — | — | — | — |
| `upload` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `export` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ai_analyze` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `manage_users` | ✓ | ✓ | — | — | — | — | — |
| `configure` | ✓ | ✓ | — | — | — | — | — |

### 6.4 Evaluación de Permisos

El hook `usePermissions()` expone la función `can(accion, modulo)`:

```
can('read', 'financiero')    → true/false
can('upload', 'operaciones') → true/false
can('delete', 'cualquiera')  → true/false
```

La evaluación ocurre en cliente para decisiones de UI (mostrar/ocultar botones). La evaluación también ocurre en servidor (Supabase RLS + Route Handlers) para seguridad real.

**La UI nunca es el único control de acceso.** Los permisos siempre se verifican en servidor.

---

## 7. Row Level Security (RLS) en Supabase

### 7.1 Principio

Toda tabla de datos del ERP tiene políticas RLS activas. Un usuario autenticado solo puede leer y modificar los registros de su empresa y para los que tiene permiso.

### 7.2 Columnas de Control

Todas las tablas de datos incluyen:

| Columna | Tipo | Descripción |
|---|---|---|
| `empresa_id` | UUID | Empresa propietaria del registro |
| `created_by` | UUID | Usuario que creó el registro |
| `visible_roles` | text[] | Roles que pueden ver este registro |

### 7.3 Políticas RLS Estándar

```
SELECT: empresa_id = auth.empresa_activa() AND rol_usuario IN (visible_roles)
INSERT: empresa_id = auth.empresa_activa() AND can('create', tabla)
UPDATE: empresa_id = auth.empresa_activa() AND can('update', tabla)
DELETE: empresa_id = auth.empresa_activa() AND can('delete', tabla)
```

Las funciones `auth.empresa_activa()` y `can()` son funciones PostgreSQL que leen los claims del JWT de Supabase.

---

## 8. Claims del JWT de Supabase

El JWT que Supabase emite incluye claims personalizados con la información de permisos:

```
Claims del JWT:
{
  sub: "uuid-del-usuario",
  email: "juan.perez@inlop.com.co",
  app_metadata: {
    empresa_id: "uuid-empresa-activa",
    empresas: ["uuid-empresa-1", "uuid-empresa-2"],  ← todas las empresas del usuario
    roles: ["operaciones", "proyecto"],
    permisos: ["read", "upload", "export", "ai_analyze"]
  }
}
```

Estos claims se actualizan cuando:
- El usuario cambia de empresa activa.
- Un admin modifica los roles del usuario.
- Se agrega el usuario a una nueva empresa.

---

## 9. Flujo de Cambio de Empresa

```
Usuario selecciona nueva empresa en selector
       │
       ▼
  Llamada a POST /api/auth/session con { empresa_id: nuevo_id }
       │
       ▼
  Server verifica que el usuario pertenece a esa empresa
       │
       ▼
  Supabase refresca JWT con nuevo empresa_id en claims
       │
       ▼
  Cookie de sesión se actualiza
       │
       ▼
  Cliente invalida toda la caché de TanStack Query
       │
       ▼
  Redirige al módulo por defecto de la nueva empresa
       │
       ▼
  Todos los fetch subsiguientes usan el nuevo empresa_id
```

---

## 10. Manejo de Sesiones Expiradas

### 10.1 Detección

- Supabase detecta JWT expirado antes de cada llamada y lo renueva automáticamente.
- Si el refresh_token también expiró: el cliente de Supabase emite el evento `SIGNED_OUT`.

### 10.2 Respuesta a Sesión Expirada

```
Evento SIGNED_OUT detectado
       │
       ├── Limpiar estado global (user, empresa, permisos)
       ├── Cancelar queries pendientes de TanStack Query
       ├── Mostrar Toast: "Tu sesión ha expirado. Vuelve a ingresar."
       └── Redirigir a /login?returnUrl=[ruta-actual]
```

### 10.3 Persistencia de Trabajo Pendiente

- Los formularios con datos no guardados muestran un warning antes del redirect.
- Los datos del formulario se guardan en sessionStorage como borrador temporal.
- Al re-autenticarse, si el borrador existe, se ofrece restaurar.

---

## 11. Seguridad Adicional

### 11.1 Headers de Seguridad

El middleware agrega headers a todas las respuestas:

| Header | Valor |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Definido por módulo |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

### 11.2 Protección de API Routes

Todas las Route Handlers de `app/api/` verifican:
1. JWT de Supabase válido en la cookie de la request.
2. Permiso específico para la acción solicitada.
3. Que `empresa_id` en el JWT coincida con los datos solicitados.

Ninguna API Route confía en parámetros de empresa enviados por el cliente.

### 11.3 Claude API — Proxy de Seguridad

La clave de API de Anthropic **nunca se expone al cliente**. Todas las llamadas a Claude AI pasan por:

```
Cliente → POST /api/ai/analisis → Route Handler (servidor)
                                        │
                                        ├── Verifica JWT Supabase
                                        ├── Verifica permiso ai_analyze
                                        ├── Sanitiza y valida el payload
                                        └── Llama a Anthropic API con ANTHROPIC_API_KEY
                                              (variable de entorno, solo servidor)
```

### 11.4 Auditoría

Acciones sensibles se registran en una tabla `audit_log` de Supabase:

| Acción auditada | Datos registrados |
|---|---|
| Login / Logout | usuario, timestamp, IP, user-agent |
| Cambio de empresa | usuario, empresa_anterior, empresa_nueva |
| Carga de Excel | usuario, archivo, timestamp, registros procesados |
| Eliminación de datos | usuario, tabla, id_registro, datos_previos |
| Cambio de roles | admin, usuario_afectado, roles_anteriores, roles_nuevos |
| Consulta AI | usuario, módulo, tokens_usados, timestamp |

---

## 12. Multiempresa — Modelo de Datos de Acceso

```
tabla: usuarios
  id: UUID
  email: text
  azure_oid: text          ← Object ID de Azure AD (clave de federación)
  nombre: text

tabla: empresa_usuarios     ← tabla puente
  empresa_id: UUID
  usuario_id: UUID
  roles: text[]             ← roles del usuario en ESA empresa
  activo: boolean
  created_at: timestamp

tabla: empresas
  id: UUID
  nombre: text
  logo_url: text
  modulos_activos: text[]   ← módulos habilitados para la empresa
  configuracion: jsonb
```

### Consulta de Acceso

Al iniciar sesión, el sistema carga:
1. Todas las empresas del usuario (via `empresa_usuarios`).
2. Si hay solo una empresa: se establece como activa automáticamente.
3. Si hay múltiples: se muestra el selector de empresa antes de entrar al portal.
4. Los roles del usuario se cargan específicos a la empresa activa.

---

## 13. Diagrama de Estados de Sesión

```
  [Sin sesión]
      │
      │  Login exitoso (MSAL + Supabase)
      ▼
  [Sesión activa]
      │         │
      │         │  JWT próximo a expirar
      │         │  (< 5 min)
      │         ▼
      │   [Renovando token]
      │         │
      │         ├── Renovación exitosa → [Sesión activa]
      │         └── Renovación fallida → [Sesión expirada]
      │
      │  Logout explícito
      ▼
  [Sin sesión]

  [Sesión expirada]
      │
      │  Re-login (MSAL silent si posible)
      ▼
  [Sesión activa]
      │
      │  MSAL también expirado
      ▼
  [Login completo requerido]
      │
      │  Usuario se autentica de nuevo
      ▼
  [Sesión activa]
```
