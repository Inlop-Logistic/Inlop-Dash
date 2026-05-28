# INLOP Auth System — Guía de Integración
**Supabase Auth v2 · Vanilla JS · Sin frameworks**

---

## 📁 Estructura de archivos

```
/app
├── login.html                ← Página pública de acceso
├── forgot-password.html      ← Solicitud de reset de contraseña
├── reset-password.html       ← Nueva contraseña (desde correo)
├── index.html                ← Dashboard (página privada - no tocar)
│
├── auth/
│   └── callback.html         ← Captura tokens de Supabase
│
└── js/
    ├── supabase.js           ← ① SIEMPRE primero. Cliente Supabase + config
    ├── auth.js               ← ② Protección de rutas (páginas privadas)
    ├── login.js              ← Lógica del formulario de login
    ├── logout.js             ← Cierre de sesión
    ├── forgot-password.js    ← Envío de email de reset
    └── reset-password.js     ← Actualización de contraseña
```

---

## ⚙️ Configuración en Supabase Dashboard

### 1. URL de la aplicación
En **Authentication → URL Configuration**:
- **Site URL:** `https://inloplogistica.com/app`
- **Redirect URLs (whitelist):**
  ```
  https://inloplogistica.com/app/auth/callback.html
  https://inloplogistica.com/app/reset-password.html
  ```

### 2. Email Templates
En **Authentication → Email Templates → Reset Password**, editar el enlace a:
```
{{ .SiteURL }}/auth/callback.html#access_token={{ .Token }}&type=recovery
```

---

## 🔒 Cómo proteger una página privada

En **CUALQUIER página del dashboard** (ej: `index.html`), añade estos dos scripts
en el `<head>` o al inicio del `<body>`, **ANTES** de tu propio JavaScript:

```html
<!-- 1. CDN de Supabase -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- 2. Cliente INLOP (inicializa window.INLOP.sb) -->
<script src="/app/js/supabase.js"></script>

<!-- 3. Protección de ruta (redirige si no hay sesión) -->
<script src="/app/js/auth.js"></script>

<!-- 4. Logout (si tienes botón de cerrar sesión) -->
<script src="/app/js/logout.js"></script>

<!-- 5. TU JavaScript del dashboard -->
<script src="/app/js/tu-dashboard.js"></script>
```

**El botón de logout** debe tener `id="logout-btn"`:
```html
<button id="logout-btn">Cerrar sesión</button>
```

### Usar datos del usuario en el dashboard
Después de que `auth.js` valide la sesión, dispara el evento `inlop:userReady`:

```javascript
document.addEventListener('inlop:userReady', (e) => {
  const { nombre, rol, email } = e.detail;
  document.getElementById('user-name').textContent = nombre;
  document.getElementById('user-role').textContent = rol;
});
```

O accede directamente (disponible después de que auth.js cargue):
```javascript
const user = window.INLOP.currentUser;
// { id, email, nombre, rol }
```

---

## 📂 Rutas en `supabase.js`

Si cambias la estructura de carpetas, actualiza el objeto `paths` en `js/supabase.js`:

```javascript
paths: {
  login:         '/app/login.html',
  dashboard:     '/app/index.html',
  resetPassword: '/app/reset-password.html',
  callback:      '/app/auth/callback.html',
},
```

---

## 🔄 Flujo completo del sistema

```
LOGIN NORMAL:
  login.html → [Supabase Auth] → success overlay → index.html

RECUPERACIÓN DE CONTRASEÑA:
  login.html
    → forgot-password.html
    → [Supabase envía email con link]
    → auth/callback.html  ← captura token, detecta type=recovery
    → reset-password.html ← usuario escribe nueva contraseña
    → [Supabase updateUser()]
    → login.html

PROTECCIÓN DE RUTA:
  cualquier-pagina-privada.html
    → auth.js se ejecuta
    → [getSession()]
    ├── sin sesión → login.html?reason=sesion-expirada
    └── con sesión → página carga normalmente
```

---

## 📤 Subir a GitHub y luego a cPanel

### GitHub
```bash
# En la raíz de tu repositorio
git add app/
git commit -m "feat: modular auth system con Supabase v2"
git push origin main
```

### cPanel (Colombia Hosting)
1. Entra a **cPanel → Administrador de archivos**
2. Navega a `public_html/app/`
3. Sube los archivos respetando la misma estructura
4. Verifica que `js/` y `auth/` estén en las rutas correctas
5. Prueba en: `https://inloplogistica.com/app/login.html`

### Alternativa: Git en cPanel
Si tu hosting tiene Git:
```bash
# En cPanel → Git Version Control → clonar o hacer pull
```

---

## 🧪 Checklist de pruebas

- [ ] Login con credenciales correctas → dashboard
- [ ] Login con credenciales incorrectas → mensaje de error
- [ ] Acceso directo a `index.html` sin login → redirige a login
- [ ] "¿Olvidaste tu contraseña?" → correo llega con link
- [ ] Clic en link del correo → `callback.html` → `reset-password.html`
- [ ] Nueva contraseña válida → redirige a login
- [ ] Nueva contraseña inválida (< 8 chars) → error en formulario
- [ ] Logout → sessionStorage limpio → redirige a login
- [ ] Sesión activa + abrir login.html → redirige directo al dashboard

---

## ⚠️ Notas de seguridad

- La `supabaseKey` es la **anon key** (pública por diseño en Supabase).
  No expone datos privados mientras las **Row Level Security (RLS)** estén activadas.
- Activa RLS en la tabla `profiles` en Supabase Dashboard.
- Para producción avanzada, usa variables de entorno con un build step (Vite, etc.).
- El `sessionStorage` se limpia al cerrar el navegador.
  Supabase maneja la persistencia real en `localStorage` con su propio mecanismo.
