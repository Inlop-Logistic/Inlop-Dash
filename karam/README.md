# KARAM · Panel administrativo (V1)

PWA local, mobile-first, para el control operativo y financiero de una
cocina oculta / restaurante pequeño: **Pedidos → Ventas → Costos → Compras
→ Inventario → Gastos → Caja → Capital → Utilidad**.

## Cómo correrla

Es 100% estática — no requiere backend ni build step. Cualquier servidor
estático sirve:

```bash
cd karam
python3 -m http.server 8080
# abrir http://localhost:8080
```

Debe servirse por **http(s)**, no abrirse como `file://`, porque el
Service Worker y el manifest de instalación PWA lo requieren.

**Acceso inicial:** usuario `admin`, contraseña `karam2026` (cámbiala
desde Configuración apenas entres).

## Estructura

```
karam/
├── index.html            # shell de la app (login + layout + nav)
├── manifest.webmanifest   # metadata de instalación PWA
├── sw.js                  # service worker (cache-first, offline)
├── css/styles.css         # design system (paleta claro/oscuro/borgoña/dorado)
├── icons/icon.svg         # ícono de marca (K)
└── js/
    ├── db.js               # wrapper sobre IndexedDB (CRUD genérico)
    ├── repo.js              # capa Repository (contrato estable para migrar a Supabase)
    ├── auth.js               # login local + hash de contraseña (SHA-256 + salt)
    ├── calc.js                # motor de costeo, promociones y finanzas
    ├── utils.js                # formato COP, fechas, CSV, WhatsApp, toasts
    ├── modal.js                 # helpers de modal genérico
    ├── app.js                    # bootstrap, router hash, navegación
    └── views/*.js                 # una vista por módulo (13 módulos)
```

## Capa Repository → futura migración a Supabase

Todo acceso a datos pasa por `window.KaramRepo` (`js/repo.js`). Cada
entidad expone `all() / get(id) / create(data) / update(id, patch) /
remove(id)`, todas devuelven Promesas. Hoy `repo.js` llama a
`KaramDB` (IndexedDB); migrar a Supabase implica reescribir el cuerpo de
`makeRepo()` para usar `supabase-js` manteniendo el mismo contrato — las
vistas no deberían cambiar.

## Decisiones menores documentadas (V1, sin sobrearquitectura)

- **order_items / purchase_items** no son stores separados: van
  embebidos como array dentro de `orders` / `purchases`. IndexedDB es un
  almacén de documentos; normalizar no aporta valor aquí.
- **inventory** no es un store aparte: el stock vive en `ingredients`
  (`stock`, `minStock`). Los movimientos sí quedan en
  `inventory_movements` para trazabilidad (entrada/consumo/ajuste/merma).
- **Venta automática desde pedido:** la venta y el movimiento de caja se
  generan al **crear** el pedido (no al marcarlo "entregado"), porque en
  una cocina oculta el pago normalmente se confirma antes de preparar.
  Cancelar un pedido revierte la venta, la caja y el inventario
  consumido.
- **Hash de contraseña:** SHA-256 + salt aleatorio vía Web Crypto
  (`SubtleCrypto`). No es bcrypt/argon2 (no disponibles nativamente en
  browser sin librerías externas), pero nunca se guarda texto plano.
- **Semáforo de capital:** verde si el dinero disponible supera un
  colchón de precaución (20% del capital protegido, mínimo $50.000),
  amarillo si está entre 0 y ese colchón, rojo si es negativo. Umbral
  arbitrario documentado, editable a futuro si se requiere.
- **Reparto de utilidades entre socios:** NO se calcula automáticamente
  (regla explícita del brief). El módulo de Socios solo registra aportes,
  retiros y sueldos.

## Criterio financiero

El sistema distingue siempre **VENTA ≠ UTILIDAD ≠ CAJA ≠ DINERO
DISPONIBLE**:

- **Venta**: ingreso bruto de cada pedido.
- **Utilidad/Margen**: venta − costo de ingredientes.
- **Caja**: saldo acumulado de todos los movimientos (ventas, compras,
  gastos, retiros, sueldos, aportes).
- **Dinero disponible**: Caja − Capital protegido − Gastos pendientes −
  Reserva. Nunca se muestra la caja como si fuera utilidad disponible
  para retirar.

## Pendientes reales (fuera de alcance de V1)

- Multiusuario/roles granulares (V1 solo tiene un usuario admin local).
- Reparto automático de utilidades por socio (bloqueado a propósito).
- Sincronización real con Supabase (la capa Repository ya está lista,
  falta implementar el backend).
- Notificaciones push / recordatorios.
- Generación de PDF de recibo (V1 solo exporta CSV).
