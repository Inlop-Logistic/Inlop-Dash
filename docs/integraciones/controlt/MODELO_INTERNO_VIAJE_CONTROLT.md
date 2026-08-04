# Modelo Interno de Viaje ControlT

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Generado por:** `services/controlt-soap/tripMapper.js`  
**Referencia oficial para:** Fase 4 y todas las fases posteriores

---

## Índice

1. [Entidad Viaje](#1-entidad-viaje)
2. [Entidad Parada](#2-entidad-parada)
3. [Entidad Producto](#3-entidad-producto)
4. [Relaciones entre entidades](#4-relaciones-entre-entidades)
5. [Campos obligatorios](#5-campos-obligatorios)
6. [Campos opcionales](#6-campos-opcionales)
7. [Campos derivados](#7-campos-derivados)
8. [Estados calculados](#8-estados-calculados)
9. [Estrategia de sincronización](#9-estrategia-de-sincronización)
10. [Ejemplo completo](#10-ejemplo-completo)

---

## 1. Entidad Viaje

Tipo: `ViajeRow` (definido en `tripMapper.js`).  
Representa el resultado de mapear una respuesta `GetDetailMonitoringOrder` al modelo de dominio INLOP.  
Se persiste como una fila en la tabla `controlt_viajes` de Supabase.

| Campo | Tipo JS | Tipo DB | Descripción |
|---|---|---|---|
| `codigo_controlt` | `string` | `TEXT NOT NULL` | Clave primaria — código de viaje ControlT (ej. `IN018108`). Siempre trimmed. |
| `estado_viaje` | `string` | `TEXT NOT NULL` | Estado calculado del ciclo de vida. Ver §8. |
| `conductor_cedula` | `string \| null` | `TEXT` | Número de documento del conductor asignado. |
| `conductor_nombre` | `string \| null` | `TEXT` | Nombre completo del conductor asignado. |
| `tipo_operacion_codigo` | `number \| null` | `INTEGER` | Código de catálogo ControlT para el tipo de operación. |
| `tipo_viaje_codigo` | `number \| null` | `INTEGER` | Código de catálogo ControlT para el tipo de viaje. |
| `tipo_carga_codigo` | `number \| null` | `INTEGER` | Código de catálogo ControlT para el tipo de carga. |
| `valor_mercancia` | `number \| null` | `NUMERIC` | Valor declarado de la mercancía. |
| `moneda` | `string \| null` | `TEXT` | Código de moneda (ej. `COP`, `USD`). |
| `valor_flete` | `number \| null` | `NUMERIC` | Valor del flete pactado. |
| `peso_total_ton` | `number \| null` | `NUMERIC` | Peso total de la carga en toneladas. |
| `volumen_total` | `number \| null` | `NUMERIC` | Volumen total de la carga. |
| `temperatura_min` | `number \| null` | `NUMERIC` | Temperatura mínima requerida (carga refrigerada). |
| `temperatura_max` | `number \| null` | `NUMERIC` | Temperatura máxima requerida (carga refrigerada). |
| `instrucciones` | `string \| null` | `TEXT` | Instrucciones operativas especiales. |
| `paradas` | `Parada[]` | `JSONB NOT NULL DEFAULT '[]'` | Array de paradas. Siempre presente; puede ser vacío. |
| `fecha_evento` | `string \| null` | `TIMESTAMPTZ` | Timestamp del último evento registrado. Ver §7. |
| `sincronizado_en` | *(no en ViajeRow)* | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Momento de escritura en Supabase. Lo agrega `persistenceLayer`, no `tripMapper`. |

---

## 2. Entidad Parada

Cada elemento del array `paradas` dentro de `ViajeRow`.  
Se almacena como objeto dentro del array JSONB `paradas` de `controlt_viajes`.

| Campo | Tipo JS | Descripción |
|---|---|---|
| `orden` | `number` | Número de secuencia de la parada (1-based). Fallback: posición en el array + 1. |
| `nombre` | `string \| null` | Nombre descriptivo del punto (ej. `"Bodega Central Bogotá"`). |
| `direccion` | `string \| null` | Dirección textual del punto. |
| `lat` | `number \| null` | Latitud geográfica (WGS 84). |
| `lng` | `number \| null` | Longitud geográfica (WGS 84). |
| `estado` | `string \| null` | Estado de la parada según ControlT (ej. `"Completado"`, `"Pendiente"`). Texto libre, no enum. |
| `hora_programada` | `string \| null` | Fecha/hora programada de llegada (string ISO del SOAP). |
| `hora_real` | `string \| null` | **Campo clave.** Fecha/hora de llegada real registrada. `null` = parada no completada. Usado para derivar `estado_viaje`. |
| `eta` | `string \| null` | ETA calculada por ControlT para esta parada. |
| `tipo` | `string \| null` | Tipo de parada según ControlT (ej. `"CARGUE"`, `"DESCARGUE"`, `"PERNOCTE"`). Texto libre. |
| `productos` | `Producto[]` | Productos asociados a esta parada. Siempre presente; puede ser vacío. |

---

## 3. Entidad Producto

Cada elemento del array `productos` dentro de una `Parada`.

| Campo | Tipo JS | Descripción |
|---|---|---|
| `descripcion` | `string \| null` | Nombre o descripción del producto. |
| `cantidad` | `number \| null` | Cantidad de unidades o bultos. |
| `unidad` | `string \| null` | Unidad de medida (ej. `"Bolsas"`, `"Toneladas"`, `"Pallets"`). |
| `peso_ton` | `number \| null` | Peso del producto en toneladas. |
| `volumen` | `number \| null` | Volumen del producto. |

---

## 4. Relaciones entre entidades

```
ViajeRow
│
│  1
└──────────────── paradas: Parada[]
                     │
                     │  N  (uno por ViajeRow·Parada)
                     └──────────── productos: Producto[]
```

- **ViajeRow → Parada**: relación 1:N embebida. Un viaje tiene cero o más paradas ordenadas por el campo `orden`.
- **Parada → Producto**: relación 1:N embebida. Una parada tiene cero o más productos.
- No existen FKs externas — `controlt_viajes` está desacoplada de otras tablas del ERP por diseño (Adapter Pattern). Si existe una `solicitud_cliente` con `controlt_trip_number = codigo_controlt`, la reconciliación es responsabilidad del consumidor (Fase 4+), no del modelo de dominio ControlT.

---

## 5. Campos obligatorios

Estos campos siempre tienen un valor no nulo en una `ViajeRow` válida. Un `MappingError` es imposible si el llamador pasa un `codigoViaje` no vacío.

| Campo | Fuente | Invariante |
|---|---|---|
| `codigo_controlt` | Argumento `codigoViaje` del llamador | `string` no vacía, trimmed. `MappingError` si el argumento es nulo, vacío o no-string. |
| `estado_viaje` | Derivado de `paradas[*].hora_real` | Siempre uno de los 5 valores válidos. Nunca `null`. Si `paradas` está vacío → `PENDIENTE`. |
| `paradas` | `Paradas.Parada` en el SOAP | Siempre un array. `[]` cuando el SOAP no incluye paradas. |

Los tres campos mapean a columnas `NOT NULL` en la base de datos.

---

## 6. Campos opcionales

Todos los demás campos de `ViajeRow` y de los objetos embebidos son opcionales: `tripMapper` los mapea a `null` cuando el SOAP no los incluye, cuando vienen vacíos, o cuando el valor no puede convertirse al tipo esperado. Esto es intencional (tolerant reader) para garantizar que ningún campo faltante en ControlT provoque un error en el ERP.

**En ViajeRow:**
`conductor_cedula`, `conductor_nombre`, `tipo_operacion_codigo`, `tipo_viaje_codigo`, `tipo_carga_codigo`, `valor_mercancia`, `moneda`, `valor_flete`, `peso_total_ton`, `volumen_total`, `temperatura_min`, `temperatura_max`, `instrucciones`, `fecha_evento`.

**En Parada:**
`nombre`, `direccion`, `lat`, `lng`, `estado`, `hora_programada`, `hora_real`, `eta`, `tipo`.

**En Producto:**
`descripcion`, `cantidad`, `unidad`, `peso_ton`, `volumen`.

**Conversiones de tipo aplicadas a campos opcionales:**

| Conversión | Función | Comportamiento |
|---|---|---|
| A string | `toStr(v)` | `String(v).trim()`; vacío o nulo → `null`. |
| A entero | `toInt(v)` | `parseInt(..., 10)`; no finito → `null`. |
| A decimal | `toFloat(v)` | `parseFloat(v.replace(',', '.'))` — acepta coma decimal (ej. `"12,5"` → `12.5`); no finito → `null`. |

---

## 7. Campos derivados

### `estado_viaje`

Calculado por `deriveEstado(paradas)` a partir de los valores `hora_real` de las paradas. Ver §8 para la tabla completa de reglas.

**No se persiste directamente desde el SOAP** — ningún campo SOAP se mapea a `estado_viaje`. ControlT informa el estado de cada parada individualmente (`Parada.estado`); el estado del viaje completo lo calcula INLOP.

### `fecha_evento`

Representa el timestamp del último evento de negocio conocido en el viaje. Se obtiene en orden de prioridad:

| Prioridad | Campo SOAP evaluado |
|---|---|
| 1 | `FechaUltimoEvento` |
| 2 | `UltimaFechaEvento` |
| 3 | `FechaEvento` |
| 4 | La `hora_real` más reciente (lexicográficamente) entre todas las paradas |

Si ninguna fuente produce un valor, `fecha_evento` es `null`.

### `parada.orden`

Normalmente proviene de `NumeroParada` en el SOAP (valor entero). Si ese campo está ausente o no parseable, se usa la posición del objeto en el array SOAP (índice 0-based + 1).

### `sincronizado_en`

No es parte de `ViajeRow` — lo agrega `persistenceLayer.upsertViaje()` con `new Date().toISOString()` en el momento exacto de la escritura a Supabase, sobreescribiendo cualquier valor que pudiera existir en el objeto previo. Garantiza que el campo refleja la hora de la última sincronización real.

---

## 8. Estados calculados

La función `deriveEstado(paradas)` aplica las siguientes reglas en orden. **La primera que coincide gana.**

| # | Condición | Estado resultante | Semántica de negocio |
|---|---|---|---|
| 1 | `paradas` vacío o no es array | `PENDIENTE` | Viaje sin paradas definidas — no ha comenzado. |
| 2 | Ninguna parada tiene `hora_real` | `PENDIENTE` | Viaje programado, aún sin movimiento registrado. |
| 3 | **Todas** las paradas tienen `hora_real` | `COMPLETADO` | Todas las paradas ejecutadas — viaje finalizado. |
| 4 | La **última** parada tiene `hora_real` y hay **más de una** parada con `hora_real` | `EN_DESCARGUE` | Se está descargando en el destino final. |
| 5 | Al menos una parada que **no es la primera** tiene `hora_real`, y la última **no** tiene | `EN_TRANSITO` | Vehículo en ruta entre paradas intermedias. |
| 6 | Solo la **primera** parada tiene `hora_real` | `EN_CARGUE` | Cargando en el origen; ninguna parada posterior ejecutada. |

**Diagrama de transición:**

```
              Arranque del viaje
                     │
                     ▼
               PENDIENTE ──── primera parada registrada ────► EN_CARGUE
                                                                   │
                                               parada intermedia   │
                                               registrada          │
                                                                   ▼
                                                              EN_TRANSITO
                                                                   │
                                               última parada       │
                                               registrada          │
                                                                   ▼
                                                             EN_DESCARGUE
                                                                   │
                                               todas las paradas   │
                                               registradas         │
                                                                   ▼
                                                             COMPLETADO
```

**Valores válidos del check constraint en Supabase:**
`PENDIENTE`, `EN_CARGUE`, `EN_TRANSITO`, `EN_DESCARGUE`, `COMPLETADO`

**Invariante:** `deriveEstado` siempre retorna uno de estos cinco valores y nunca lanza excepción.

---

## 9. Estrategia de sincronización

### Patrón: Cache-aside con upsert en PK

`controlt_viajes` actúa como caché persistente de las respuestas SOAP. No es la tabla de verdad del viaje en el ERP (esa es `solicitudes_cliente` / `cumplidos`), sino el espejo más reciente de lo que ControlT informó.

### Escritura

`persistenceLayer.upsertViaje(viajeRow, { sbFetch })` envía:

```http
POST /rest/v1/controlt_viajes
Prefer: resolution=merge-duplicates,return=minimal
Content-Type: application/json
```

- **Merge-duplicates**: si ya existe una fila con el mismo `codigo_controlt`, sus columnas se actualizan con los valores nuevos. Los campos que no cambian en ControlT conservan su valor anterior.
- **No replace-all**: no se elimina ni re-inserta la fila completa — solo se actualiza.
- `sincronizado_en` se sobreescribe siempre con `now()` del momento de la llamada.

### Lectura

`persistenceLayer.fetchViaje(codigoViaje, { sbFetch })` retorna:

- La fila más reciente para `codigo_controlt` si existe.
- `null` si no existe (caché fría — necesita llamada SOAP).

Los consumidores (Fase 4+) deciden si el dato en caché es suficientemente fresco comparando `sincronizado_en` con el tiempo actual.

### Ciclo de vida del token (fuera de tripMapper)

`tripMapper` y `persistenceLayer` no gestionan autenticación. El token SOAP lo gestiona exclusivamente `authManager`. El flujo completo de sincronización es:

```
authManager.getToken(loginFn)
    → soapGateway.getDetailMonitoringOrder(codigoViaje, config)
        → tripMapper.mapToViajeRow(soapResult, codigoViaje)
            → persistenceLayer.upsertViaje(viajeRow, { sbFetch })
```

### Manejo de errores en sincronización

| Error | Origen | Efecto |
|---|---|---|
| `MappingError` | `tripMapper` | `codigoViaje` inválido — no se llama al SOAP. |
| `AuthError` | `authManager` | Login fallido — no se puede obtener datos. |
| `SoapFaultError` con auth | `soapGateway` | Token invalidado; el llamador debe reintentar. |
| `ViajeNotFoundError` | `soapGateway` | Viaje inexistente en ControlT; no hay datos que cachear. |
| `MappingError` (constraint) | `persistenceLayer` | Datos SOAP inconsistentes con el schema — investigar contrato. |
| `ServiceUnavailableError` | `persistenceLayer` | Supabase no disponible — datos no persistidos en este ciclo. |

---

## 10. Ejemplo completo

### 10.1 Contexto

Viaje **IN018108** — transporte de cemento desde Bogotá hasta Medellín.  
Estado en el momento de la consulta: **EN_TRANSITO** (parada de origen completada, parada intermedia en camino, destino pendiente).

### 10.2 Respuesta XML del SOAP (fragmento representativo)

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <GetDetailMonitoringOrderResponse xmlns="http://controlt.com.co/">
      <GetDetailMonitoringOrderResult>
        <Conductor>
          <Cedula>52496301</Cedula>
          <Nombre>Carlos Andrés Herrera Ríos</Nombre>
        </Conductor>
        <TipoOperacion>2</TipoOperacion>
        <TipoViaje>1</TipoViaje>
        <TipoCarga>3</TipoCarga>
        <ValorMercancia>87500000</ValorMercancia>
        <Moneda>COP</Moneda>
        <ValorFlete>4200000</ValorFlete>
        <PesoTotal>24,5</PesoTotal>
        <VolumenTotal>14,0</VolumenTotal>
        <TemperaturaMinima xsi:nil="true"/>
        <TemperaturaMaxima xsi:nil="true"/>
        <Instrucciones>No apilar más de 4 niveles. Carga frágil en esquinas.</Instrucciones>
        <FechaUltimoEvento>2026-07-15T14:22:00</FechaUltimoEvento>
        <Paradas>
          <Parada>
            <NumeroParada>1</NumeroParada>
            <NombreParada>Planta Cementos Argos — Bogotá</NombreParada>
            <Direccion>Autopista Norte Km 7, Bogotá D.C.</Direccion>
            <Latitud>4.7831</Latitud>
            <Longitud>-74.0475</Longitud>
            <EstadoParada>Completado</EstadoParada>
            <FechaProgramada>2026-07-15T07:00:00</FechaProgramada>
            <FechaReal>2026-07-15T07:42:00</FechaReal>
            <FechaETA xsi:nil="true"/>
            <TipoParada>CARGUE</TipoParada>
            <Productos>
              <Producto>
                <Descripcion>Cemento Gris Argos 50kg</Descripcion>
                <Cantidad>490</Cantidad>
                <UnidadMedida>Bultos</UnidadMedida>
                <PesoToneladas>24,5</PesoToneladas>
                <Volumen>14,0</Volumen>
              </Producto>
            </Productos>
          </Parada>
          <Parada>
            <NumeroParada>2</NumeroParada>
            <NombreParada>Peaje La Cabaña</NombreParada>
            <Direccion>Autopista Bogotá-Medellín, Villeta</Direccion>
            <Latitud>4.9981</Latitud>
            <Longitud>-74.4708</Longitud>
            <EstadoParada>En camino</EstadoParada>
            <FechaProgramada>2026-07-15T10:30:00</FechaProgramada>
            <FechaReal>2026-07-15T11:08:00</FechaReal>
            <FechaETA xsi:nil="true"/>
            <TipoParada>PERNOCTE</TipoParada>
            <Productos/>
          </Parada>
          <Parada>
            <NumeroParada>3</NumeroParada>
            <NombreParada>Ferrería La Unión — Medellín</NombreParada>
            <Direccion>Calle 30 # 65-120, Medellín</Direccion>
            <Latitud>6.2317</Latitud>
            <Longitud>-75.5747</Longitud>
            <EstadoParada>Pendiente</EstadoParada>
            <FechaProgramada>2026-07-15T18:00:00</FechaProgramada>
            <FechaReal xsi:nil="true"/>
            <FechaETA>2026-07-15T17:45:00</FechaETA>
            <TipoParada>DESCARGUE</TipoParada>
            <Productos>
              <Producto>
                <Descripcion>Cemento Gris Argos 50kg</Descripcion>
                <Cantidad>490</Cantidad>
                <UnidadMedida>Bultos</UnidadMedida>
                <PesoToneladas>24,5</PesoToneladas>
                <Volumen>14,0</Volumen>
              </Producto>
            </Productos>
          </Parada>
        </Paradas>
      </GetDetailMonitoringOrderResult>
    </GetDetailMonitoringOrderResponse>
  </soap:Body>
</soap:Envelope>
```

### 10.3 Objeto SOAP parseado (después de `deepFixMojibake`)

`soapGateway.getDetailMonitoringOrder()` retorna el siguiente objeto JavaScript, con namespace strips aplicados por `fast-xml-parser` y mojibake corregido:

```json
{
  "GetDetailMonitoringOrderResult": {
    "Conductor": {
      "Cedula": "52496301",
      "Nombre": "Carlos Andrés Herrera Ríos"
    },
    "TipoOperacion": "2",
    "TipoViaje": "1",
    "TipoCarga": "3",
    "ValorMercancia": "87500000",
    "Moneda": "COP",
    "ValorFlete": "4200000",
    "PesoTotal": "24,5",
    "VolumenTotal": "14,0",
    "TemperaturaMinima": null,
    "TemperaturaMaxima": null,
    "Instrucciones": "No apilar más de 4 niveles. Carga frágil en esquinas.",
    "FechaUltimoEvento": "2026-07-15T14:22:00",
    "Paradas": {
      "Parada": [
        {
          "NumeroParada": "1",
          "NombreParada": "Planta Cementos Argos — Bogotá",
          "Direccion": "Autopista Norte Km 7, Bogotá D.C.",
          "Latitud": "4.7831",
          "Longitud": "-74.0475",
          "EstadoParada": "Completado",
          "FechaProgramada": "2026-07-15T07:00:00",
          "FechaReal": "2026-07-15T07:42:00",
          "FechaETA": null,
          "TipoParada": "CARGUE",
          "Productos": {
            "Producto": {
              "Descripcion": "Cemento Gris Argos 50kg",
              "Cantidad": "490",
              "UnidadMedida": "Bultos",
              "PesoToneladas": "24,5",
              "Volumen": "14,0"
            }
          }
        },
        {
          "NumeroParada": "2",
          "NombreParada": "Peaje La Cabaña",
          "Direccion": "Autopista Bogotá-Medellín, Villeta",
          "Latitud": "4.9981",
          "Longitud": "-74.4708",
          "EstadoParada": "En camino",
          "FechaProgramada": "2026-07-15T10:30:00",
          "FechaReal": "2026-07-15T11:08:00",
          "FechaETA": null,
          "TipoParada": "PERNOCTE",
          "Productos": {}
        },
        {
          "NumeroParada": "3",
          "NombreParada": "Ferrería La Unión — Medellín",
          "Direccion": "Calle 30 # 65-120, Medellín",
          "Latitud": "6.2317",
          "Longitud": "-75.5747",
          "EstadoParada": "Pendiente",
          "FechaProgramada": "2026-07-15T18:00:00",
          "FechaReal": null,
          "FechaETA": "2026-07-15T17:45:00",
          "TipoParada": "DESCARGUE",
          "Productos": {
            "Producto": {
              "Descripcion": "Cemento Gris Argos 50kg",
              "Cantidad": "490",
              "UnidadMedida": "Bultos",
              "PesoToneladas": "24,5",
              "Volumen": "14,0"
            }
          }
        }
      ]
    }
  }
}
```

### 10.4 Derivación del `estado_viaje`

`deriveEstado` evalúa las paradas mapeadas:

| Parada | `hora_real` | Con valor |
|---|---|---|
| 1 — CARGUE | `"2026-07-15T07:42:00"` | ✅ |
| 2 — PERNOCTE | `"2026-07-15T11:08:00"` | ✅ |
| 3 — DESCARGUE | `null` | ✗ |

- ¿Todas tienen `hora_real`? No → no es `COMPLETADO`.
- ¿La última (parada 3) tiene `hora_real`? No → no es `EN_DESCARGUE`.
- ¿Alguna parada que **no es la primera** tiene `hora_real`? Sí (parada 2) → **`EN_TRANSITO`** ✅

### 10.5 `ViajeRow` resultante de `mapToViajeRow`

```json
{
  "codigo_controlt": "IN018108",
  "estado_viaje": "EN_TRANSITO",
  "conductor_cedula": "52496301",
  "conductor_nombre": "Carlos Andrés Herrera Ríos",
  "tipo_operacion_codigo": 2,
  "tipo_viaje_codigo": 1,
  "tipo_carga_codigo": 3,
  "valor_mercancia": 87500000,
  "moneda": "COP",
  "valor_flete": 4200000,
  "peso_total_ton": 24.5,
  "volumen_total": 14.0,
  "temperatura_min": null,
  "temperatura_max": null,
  "instrucciones": "No apilar más de 4 niveles. Carga frágil en esquinas.",
  "paradas": [
    {
      "orden": 1,
      "nombre": "Planta Cementos Argos — Bogotá",
      "direccion": "Autopista Norte Km 7, Bogotá D.C.",
      "lat": 4.7831,
      "lng": -74.0475,
      "estado": "Completado",
      "hora_programada": "2026-07-15T07:00:00",
      "hora_real": "2026-07-15T07:42:00",
      "eta": null,
      "tipo": "CARGUE",
      "productos": [
        {
          "descripcion": "Cemento Gris Argos 50kg",
          "cantidad": 490,
          "unidad": "Bultos",
          "peso_ton": 24.5,
          "volumen": 14.0
        }
      ]
    },
    {
      "orden": 2,
      "nombre": "Peaje La Cabaña",
      "direccion": "Autopista Bogotá-Medellín, Villeta",
      "lat": 4.9981,
      "lng": -74.4708,
      "estado": "En camino",
      "hora_programada": "2026-07-15T10:30:00",
      "hora_real": "2026-07-15T11:08:00",
      "eta": null,
      "tipo": "PERNOCTE",
      "productos": []
    },
    {
      "orden": 3,
      "nombre": "Ferrería La Unión — Medellín",
      "direccion": "Calle 30 # 65-120, Medellín",
      "lat": 6.2317,
      "lng": -75.5747,
      "estado": "Pendiente",
      "hora_programada": "2026-07-15T18:00:00",
      "hora_real": null,
      "eta": "2026-07-15T17:45:00",
      "tipo": "DESCARGUE",
      "productos": [
        {
          "descripcion": "Cemento Gris Argos 50kg",
          "cantidad": 490,
          "unidad": "Bultos",
          "peso_ton": 24.5,
          "volumen": 14.0
        }
      ]
    }
  ],
  "fecha_evento": "2026-07-15T14:22:00"
}
```

**Conversiones aplicadas:**
- `"24,5"` → `24.5` (coma decimal → punto)
- `"14,0"` → `14.0` (coma decimal → punto)
- `"2"`, `"1"`, `"3"` → `2`, `1`, `3` (`toInt`)
- `"87500000"`, `"4200000"` → `87500000`, `4200000` (`toFloat`)
- `null` (xsi:nil) → `null` (`toStr` / `toFloat`)
- Producto único en SOAP (objeto) → array de 1 elemento (`normalizeArray`)

### 10.6 Fila almacenada en `controlt_viajes`

`persistenceLayer.upsertViaje` agrega `sincronizado_en` y envía el upsert. La fila resultante en Supabase:

```json
{
  "codigo_controlt": "IN018108",
  "estado_viaje": "EN_TRANSITO",
  "conductor_cedula": "52496301",
  "conductor_nombre": "Carlos Andrés Herrera Ríos",
  "tipo_operacion_codigo": 2,
  "tipo_viaje_codigo": 1,
  "tipo_carga_codigo": 3,
  "valor_mercancia": 87500000,
  "moneda": "COP",
  "valor_flete": 4200000,
  "peso_total_ton": 24.5,
  "volumen_total": 14.0,
  "temperatura_min": null,
  "temperatura_max": null,
  "instrucciones": "No apilar más de 4 niveles. Carga frágil en esquinas.",
  "paradas": [ ... ],
  "fecha_evento": "2026-07-15T14:22:00",
  "sincronizado_en": "2026-07-15T14:25:33.847Z"
}
```

El campo `sincronizado_en` es la única diferencia entre el `ViajeRow` de `tripMapper` y la fila en base de datos. No proviene del SOAP; lo escribe exclusivamente `persistenceLayer`.

---

*Este documento describe el modelo tal como está implementado en `tripMapper.js` v1.0 (commit `f2a876f`). Cualquier cambio en los campos SOAP que maneja `tripMapper` debe reflejarse aquí antes de hacer merge.*
