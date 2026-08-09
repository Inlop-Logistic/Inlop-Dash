-- ══════════════════════════════════════════════════════════════════════════════
-- SOPORTES DE CUMPLIDO — metadata documental persistida por archivo
-- Fase: Viajes Finalizados / módulo cumplidos
--
-- Contexto: el bucket Storage "cumplidos" ya almacena los archivos físicos en
-- cumplidos/{trip_number}/{...}. Hasta ahora la única fuente de metadata era el
-- propio objeto de Storage (nombre, tamaño, mimetype) — sin registro de quién
-- subió el archivo, su nombre original, descripción o tipo documental, y con la
-- lógica de reemplazo dependiendo de parsear el nombre físico del archivo.
--
-- Esta tabla es ahora la fuente de verdad de la metadata. El nombre físico del
-- objeto en Storage es un UUID opaco (cumplidos_documentos.id); el nombre
-- legible para el usuario vive en nombre_generado y nunca se usa para lógica
-- del sistema — solo para mostrarlo en pantalla y como nombre de descarga.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists cumplidos_documentos (
  id               uuid primary key default gen_random_uuid(),
  trip_number      text not null references cumplidos(id) on delete cascade,
  ruta_storage     text not null unique,   -- path físico en el bucket: cumplidos/{trip_number}/{id}.{ext}
  nombre_generado  text not null,          -- FECHA_TRIPNUMBER_PLACA_DESCRIPCION.ext — solo para mostrar/descargar
  nombre_original  text not null,          -- nombre del archivo tal como lo entregó el usuario
  descripcion      text,                   -- opcional, ingresada en el diálogo de carga
  tipo_documento   text,                   -- opcional; inferido de la descripción cuando coincide con un tipo conocido
  tamano_bytes     bigint not null default 0,
  mime_type        text,
  usuario          text,                   -- nombre/email de quien subió el archivo (declarado por el cliente ERP)
  creado_en        timestamptz not null default now()
);

create index if not exists idx_cumplidos_documentos_trip on cumplidos_documentos(trip_number);

-- Estado documental persistido — reemplaza el valor 'pendiente' hardcodeado que
-- devolvía GET /api/cumplidos sin leer ni escribir ninguna columna real. Se
-- deriva automáticamente de la presencia de soportes: 'pendiente' sin
-- documentos, 'en_revision' con al menos uno. Los estados siguientes del flujo
-- (con_observaciones / aprobado / rechazado / listo_facturacion) quedan
-- disponibles para una fase futura de revisión manual — no existe todavía
-- ninguna acción de UI que los asigne.
alter table cumplidos
  add column if not exists estado_documental text not null default 'pendiente';
