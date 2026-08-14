/**
 * services/reportes/catalogoDatasets.js — Proyección backend del catálogo de campos
 *
 * Fuente conceptual única de verdad: erp/src/modules/configuracion/catalogos/
 * datasetsReportes.ts (CATALOGO_REPORTES). Ese archivo es TypeScript, importa
 * módulos con alias de Vite (`@/modules/...`) y vive en el árbol del frontend
 * — el backend (Node ESM plano, sin bundler) no puede importarlo directamente.
 *
 * Este archivo es la única duplicación técnica necesaria para que el Filter
 * Engine y el Column Resolver del backend (Fase 9B) puedan operar sin
 * depender del frontend, tal como quedó registrado como riesgo pendiente en
 * docs/REPORTES_AUTOMATICOS_MOTOR_GENERACION.md (Fase 9A, §8.1).
 *
 * NO es un catálogo de filtros nuevo: los mismos 5 datasets, los mismos
 * campos, las mismas claves técnicas (`campo`), los mismos flags
 * `filtrable`/`seleccionableColumna` y los mismos labels que ya existen en
 * datasetsReportes.ts. Solo se omite lo que el backend no necesita (UI-only:
 * `operadores`, `opciones`, `ordenable`) y se agrega `formatoFecha` — el
 * formato real de transporte de cada campo fecha (mdy|dmy|iso), que en el
 * frontend vive por separado en erp/.../services/api.ts
 * (FORMATO_FECHA_POR_CAMPO, Fase 8D).
 *
 * Disciplina de sincronización: cualquier cambio de campo, label o flag en
 * datasetsReportes.ts debe reflejarse aquí. No hay mecanismo automático de
 * verificación todavía — queda como decisión pendiente (ver doc de Fase 9A).
 *
 * El orden de las propiedades dentro de cada `campos` importa: el Column
 * Resolver usa el orden de inserción del objeto como "orden del catálogo"
 * cuando `columnas=[]` — debe coincidir exactamente con el orden del array
 * `campos` en datasetsReportes.ts.
 */

export const CATALOGO_DATASETS = {

  // ── Viajes Activos — TmsViaje (GET /api/viajes) ──────────────────────────
  viajes_activos: {
    campos: {
      trip_number:           { label: 'Manifiesto',              tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      number_order:           { label: 'Remisión',                 tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      company_customer_name:  { label: 'Cliente',                  tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      tipo_servicio:           { label: 'Tipo de servicio',          tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      origin_city_name:       { label: 'Ciudad de origen',         tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      destiny_city_name:      { label: 'Ciudad de destino',        tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      license_plate:          { label: 'Placa',                     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      driver_name:            { label: 'Conductor',                 tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      driver_phone:            { label: 'Celular del conductor',     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      activated_on:            { label: 'Fecha de activación',       tipo: 'fecha',    filtrable: true,  seleccionableColumna: true, formatoFecha: 'mdy' },
      linea_negocio:           { label: 'Línea de negocio',          tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      state_travel:            { label: 'Estado del viaje',          tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      last_alarm_name:         { label: 'Con novedad',               tipo: 'booleano', filtrable: true,  seleccionableColumna: true },
      cliente_normalizado:     { label: 'Cliente',                   tipo: 'cliente',   filtrable: true,  seleccionableColumna: false },
    },
  },

  // ── Solicitudes — Solicitud (GET /api/solicitudes) ───────────────────────
  solicitudes: {
    campos: {
      codigo_solicitud:  { label: 'Nro. solicitud',        tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      external_ref:       { label: 'Referencia externa',    tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      cliente:            { label: 'Cliente',                tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      canal:               { label: 'Canal',                  tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      agencia:             { label: 'Agencia',                tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      tipo_vehiculo:       { label: 'Tipo de vehículo',        tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      origen:              { label: 'Ciudad de origen',       tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      destino:             { label: 'Ciudad de destino',      tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      solicitante:         { label: 'Solicitante',            tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      conductor_nombre:    { label: 'Conductor asignado',     tipo: 'texto',  filtrable: false, seleccionableColumna: true },
      creado_en:           { label: 'Fecha de creación',      tipo: 'fecha',  filtrable: true,  seleccionableColumna: true, formatoFecha: 'iso' },
      tipo_operacion:      { label: 'Tipo de operación',      tipo: 'enum',   filtrable: true,  seleccionableColumna: true },
      fecha_requerida:     { label: 'Fecha requerida',        tipo: 'fecha',  filtrable: true,  seleccionableColumna: true, formatoFecha: 'iso' },
      estado:              { label: 'Estado',                  tipo: 'enum',   filtrable: true,  seleccionableColumna: true },
      cliente_normalizado: { label: 'Cliente',                 tipo: 'cliente', filtrable: true,  seleccionableColumna: false },
    },
  },

  // ── Programación — ViajeResumen (GET /api/programacion) ──────────────────
  programacion: {
    campos: {
      trip_number:             { label: 'Manifiesto',              tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      license_plate:            { label: 'Placa',                     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      tipo_servicio:            { label: 'Tipo de servicio',          tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      nombre_cliente:           { label: 'Cliente',                  tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      city_origin:              { label: 'Ciudad de origen',         tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      city_destination:         { label: 'Ciudad de destino',        tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      driver_name:              { label: 'Conductor',                 tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      conductor_tel:            { label: 'Celular del conductor',     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      planificado_por_nombre:   { label: 'Planificado por',           tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      observaciones:            { label: 'Observaciones',             tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      schedulate_origin:        { label: 'Fecha de despacho',         tipo: 'fecha',    filtrable: true,  seleccionableColumna: true, formatoFecha: 'dmy' },
      linea_negocio:            { label: 'Línea de negocio',          tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      estado_programacion:      { label: 'Estado de programación',    tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      activo_en_resume:         { label: 'Activo en programación',    tipo: 'booleano', filtrable: true,  seleccionableColumna: true },
      cliente_normalizado:      { label: 'Cliente',                   tipo: 'cliente',   filtrable: true,  seleccionableColumna: false },
    },
  },

  // ── Viajes Finalizados — CumplidoRecord (GET /api/cumplidos) ─────────────
  viajes_finalizados: {
    campos: {
      trip_number:             { label: 'Manifiesto',                  tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      number_order:             { label: 'Remisión',                     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      company_customer_name:    { label: 'Cliente',                      tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      license_plate:            { label: 'Placa',                         tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      driver_name:              { label: 'Conductor',                     tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      conductor_tel:            { label: 'Celular del conductor',         tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      tipo_servicio:            { label: 'Tipo de servicio',              tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      origin_city_name:         { label: 'Ciudad de origen',             tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      destiny_city_name:        { label: 'Ciudad de destino',            tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      obs:                       { label: 'Observaciones',                 tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      activated_on:              { label: 'Fecha de activación',          tipo: 'fecha',    filtrable: true,  seleccionableColumna: true, formatoFecha: 'mdy' },
      fecha_cumplido:            { label: 'Fecha de cumplido',            tipo: 'fecha',    filtrable: true,  seleccionableColumna: true, formatoFecha: 'dmy' },
      linea_negocio:             { label: 'Línea de negocio',             tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      estado_documental:         { label: 'Estado documental',            tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      state_travel:              { label: 'Estado del viaje (TMS)',       tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      tiene_soporte:             { label: 'Tiene soporte cargado',        tipo: 'booleano', filtrable: true,  seleccionableColumna: true },
      cliente_normalizado:       { label: 'Cliente',                      tipo: 'cliente',   filtrable: true,  seleccionableColumna: false },
    },
  },

  // ── Centro GPS — GpsRecord (GET /api/gps) ─────────────────────────────────
  centro_gps: {
    campos: {
      license_plate:             { label: 'Placa',                    tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      driver_name:               { label: 'Conductor',                 tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      company_customer_name:     { label: 'Cliente',                  tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      latest_gps_report:         { label: 'Último reporte GPS',        tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      trip_number:               { label: 'Manifiesto',                tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      number_order:               { label: 'Remisión',                   tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      origin_city_name:           { label: 'Ciudad de origen',          tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      destiny_city_name:          { label: 'Ciudad de destino',         tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      current_address_location:   { label: 'Ubicación actual',          tipo: 'texto',    filtrable: false, seleccionableColumna: true },
      estadoGps:                  { label: 'Estado GPS',                tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      state_travel:                { label: 'Estado del viaje (TMS)',    tipo: 'enum',     filtrable: true,  seleccionableColumna: true },
      last_alarm_name:             { label: 'Con alarma activa',         tipo: 'booleano', filtrable: true,  seleccionableColumna: true },
      cliente_normalizado:         { label: 'Cliente',                   tipo: 'cliente',   filtrable: true,  seleccionableColumna: false },
    },
  },

};

/** Devuelve el mapa de campos de un tipo_reporte, o {} si no existe. */
export function camposDe(tipoReporte) {
  return CATALOGO_DATASETS[tipoReporte]?.campos ?? {};
}
