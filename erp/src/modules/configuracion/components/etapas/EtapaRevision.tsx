/**
 * Etapa 06 — Revisión y activación
 *
 * Layout dos columnas:
 *   IZQUIERDA: resumen compacto de las 5 etapas con botón "Editar" por sección.
 *   DERECHA:   vista previa del correo derivada directamente de `datos`.
 *
 * Principios:
 *  - Toda la información se deriva de `datos` — sin estado propio ni fetches.
 *  - NO lista ítems individuales (filtros, columnas, destinatarios) — solo conteos.
 *  - NO consulta Personal, no genera archivos, no envía nada.
 *  - El preview se actualiza automáticamente al cambiar cualquier etapa del wizard.
 *  - `onIrA` delega la navegación al ConfiguradorReporte (única fuente de verdad).
 */
import { type ReactNode }                                from "react";
import { CheckCircle2, AlertCircle, Pencil,
         Mail, FileSpreadsheet, FileCode }                from "lucide-react";
import {
  labelModulo, labelTipoReporte, labelFormato, labelFrecuencia,
  etapaInfoBasicaCompleta, etapaFrecuenciaCompleta, etapaDestinatariosCompleta,
  DIAS_SEMANA,
  type DatosConfigurador,
  type EtapaId,
  type FinRecurrencia,
  type RecurrenciaReporte,
} from "../../types";
import { buscarReporte } from "../../catalogos/datasetsReportes";

interface Props {
  datos: DatosConfigurador;
  /** Navega a la etapa indicada — delegado al ConfiguradorReporte. */
  onIrA: (id: EtapaId) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "2026-08-11" → "11/08/2026" — evita el corrimiento de zona horaria de Date(). */
function formatFechaISO(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function labelFin(fin: FinRecurrencia): string {
  if (fin.modo === "nunca")        return "sin fin";
  if (fin.modo === "fecha")        return `hasta ${formatFechaISO(fin.fecha)}`;
  return `${fin.cantidad} rep.`;
}

/** Una línea de resumen de la configuración de frecuencia. */
function resumenFrecuencia(r: RecurrenciaReporte): string {
  const partes: string[] = [labelFrecuencia(r.tipo)];

  if (r.tipo === "semanal" && (r.dias_semana?.length ?? 0) > 0) {
    const abrevs = DIAS_SEMANA
      .filter(d => (r.dias_semana ?? []).includes(d.value))
      .map(d => d.label.substring(0, 2));
    partes.push(abrevs.join(", "));
  }
  if (r.tipo === "mensual" && r.dia_mes) {
    partes.push(`día ${r.dia_mes}`);
  }

  partes.push(r.horas.length > 0 ? r.horas.join(", ") : "—");
  partes.push(`desde ${formatFechaISO(r.fecha_inicio)}`);
  partes.push(labelFin(r.fin));

  return partes.join(" · ");
}

// ─── Extensiones por formato ──────────────────────────────────────────────────

const EXT_FORMATO: Record<string, string> = {
  excel:         "xlsx",
  html_filas:    "html",
  html_columnas: "html",
};

// ─── SeccionCard ──────────────────────────────────────────────────────────────

interface SeccionProps {
  numero:    number;
  titulo:    string;
  completa:  boolean;
  errorMsg?: string;
  onEditar:  () => void;
  children?: ReactNode;
}

function SeccionCard({ numero, titulo, completa, errorMsg, onEditar, children }: SeccionProps) {
  return (
    <section
      className="flex flex-col gap-2 rounded-lg p-3.5"
      style={{
        border:     `1.5px solid ${completa ? "var(--gray-200)" : "var(--danger-light)"}`,
        background: completa ? "var(--gray-50)" : "var(--danger-bg)",
      }}
    >
      {/* Cabecera: número + título + icono + botón editar */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: completa ? "var(--gray-500)" : "var(--inlop-red)" }}
        >
          {String(numero).padStart(2, "0")} · {titulo}
        </span>
        <span style={{ flex: "1 1 0" }} />
        {completa
          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success)" }} />
          : <AlertCircle  className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--inlop-red)" }} />
        }
        <button
          type="button"
          onClick={onEditar}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md
                     hover:bg-gray-100 transition-colors"
          style={{ color: "var(--gray-500)" }}
        >
          <Pencil style={{ width: "10px", height: "10px" }} />
          Editar
        </button>
      </div>

      {/* Contenido */}
      {errorMsg ? (
        <p className="text-[12.5px]" style={{ color: "var(--inlop-red)" }}>
          {errorMsg}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

// ─── PreviewCorreo ────────────────────────────────────────────────────────────
//
// Todo se deriva de `datos` — sin fetch, sin estado, sin generación de archivo.
// Se re-renderiza automáticamente cuando el wizard actualiza `datos`.

interface PreviewCorreoProps {
  datos:                DatosConfigurador;
  totalColumnasCatalogo: number;
}

function PreviewCorreo({ datos, totalColumnasCatalogo }: PreviewCorreoProps) {
  const ib = datos.infoBasica;

  // ── Destinatarios ─────────────────────────────────────────────────────────
  const nInlop    = datos.destinatarios.personal_ids.length;
  const nExternos = datos.destinatarios.correos_externos.length;
  const hayDestinatarios = nInlop + nExternos > 0;
  const paraLabel = hayDestinatarios
    ? `${nInlop} destinatario${nInlop !== 1 ? "s" : ""} INLOP · ${nExternos} externo${nExternos !== 1 ? "s" : ""}`
    : "Sin destinatarios configurados";

  // ── Adjunto derivado ──────────────────────────────────────────────────────
  // Nombre → label del reporte (sin caracteres problemáticos)
  // Extensión → según formato seleccionado
  // Detalle  → cantidad de columnas + formato visible
  const ext         = EXT_FORMATO[ib.formato] ?? "xlsx";
  const reporteSlug = labelTipoReporte(ib.tipo_reporte).replace(/\s+/g, "_");
  const adjNombre   = `${reporteSlug}.${ext}`;
  const nCols       = datos.columnas.length === 0 ? totalColumnasCatalogo : datos.columnas.length;
  const adjDetalle  =
    `${nCols} columna${nCols !== 1 ? "s" : ""} · ${labelFormato(ib.formato)}`;
  const esExcel     = ib.formato === "excel";

  // ── Fila de metadatos del email ───────────────────────────────────────────

  function FilaEmail({
    etiqueta,
    children,
    danger,
  }: {
    etiqueta: string;
    children: ReactNode;
    danger?:  boolean;
  }) {
    return (
      <div
        className="flex items-baseline gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid var(--gray-100)" }}
      >
        <span
          className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--gray-400)", width: "40px" }}
        >
          {etiqueta}
        </span>
        <span
          className="text-[13px] min-w-0"
          style={{ color: danger ? "var(--inlop-red)" : "var(--gray-700)" }}
        >
          {children}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "#fff",
        border:     "1px solid var(--gray-200)",
        boxShadow:  "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      {/* De */}
      <FilaEmail etiqueta="De">
        Sistema de Reportes INLOP
      </FilaEmail>

      {/* Para */}
      <FilaEmail etiqueta="Para" danger={!hayDestinatarios}>
        {hayDestinatarios ? (
          paraLabel
        ) : (
          <span className="italic">{paraLabel}</span>
        )}
      </FilaEmail>

      {/* Asunto */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--gray-100)" }}
      >
        {ib.asunto ? (
          <p className="font-semibold text-[14px] leading-snug" style={{ color: "var(--gray-700)" }}>
            {ib.asunto}
          </p>
        ) : (
          <p className="text-[13px] italic" style={{ color: "var(--gray-400)" }}>
            Sin asunto configurado
          </p>
        )}
      </div>

      {/* Cuerpo */}
      <div
        className="px-4 py-3"
        style={{ minHeight: "80px", borderBottom: "1px solid var(--gray-100)" }}
      >
        {ib.cuerpo.trim() ? (
          <p
            className="text-[13px] whitespace-pre-wrap leading-relaxed"
            style={{ color: "var(--gray-700)" }}
          >
            {ib.cuerpo}
          </p>
        ) : (
          <p className="text-[13px] italic" style={{ color: "var(--gray-400)" }}>
            Sin cuerpo de mensaje — se enviará solo el archivo adjunto.
          </p>
        )}
      </div>

      {/* Adjunto */}
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
        >
          {/* Ícono según formato */}
          <div
            className="shrink-0 flex items-center justify-center rounded-md"
            style={{
              width:      "30px",
              height:     "30px",
              background: esExcel
                ? "rgba(21, 128, 61, 0.10)"
                : "rgba(37, 99, 235, 0.10)",
              color: esExcel ? "#15803d" : "#2563eb",
            }}
          >
            {esExcel
              ? <FileSpreadsheet style={{ width: "14px", height: "14px" }} />
              : <FileCode        style={{ width: "14px", height: "14px" }} />
            }
          </div>

          <div className="min-w-0">
            <p
              className="text-[12.5px] font-medium truncate"
              style={{ color: "var(--gray-700)" }}
              title={adjNombre}
            >
              {adjNombre}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              {adjDetalle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EtapaRevision({ datos, onIrA }: Props) {
  const ib = datos.infoBasica;

  const infoCompleta          = etapaInfoBasicaCompleta(ib);
  const frecuenciaCompleta    = etapaFrecuenciaCompleta(datos.frecuencia);
  const destinatariosCompleta = etapaDestinatariosCompleta(datos.destinatarios);

  // Total de columnas seleccionables del catálogo de este reporte
  // (usado en el resumen izquierdo Y en el adjunto del preview)
  const totalColumnasCatalogo = buscarReporte(ib.tipo_reporte)
    ?.campos.filter(c => c.seleccionableColumna).length ?? 0;

  // ── Resúmenes de una línea (columna izquierda) ─────────────────────────────

  const resumenFiltros = datos.filtros.length === 0
    ? "Sin filtros — se incluirán todos los registros"
    : `${datos.filtros.length} filtro${datos.filtros.length !== 1 ? "s" : ""} configurado${datos.filtros.length !== 1 ? "s" : ""}`;

  const resumenColumnas = datos.columnas.length === 0
    ? `Todas las columnas disponibles (${totalColumnasCatalogo})`
    : `${datos.columnas.length} columna${datos.columnas.length !== 1 ? "s" : ""} seleccionada${datos.columnas.length !== 1 ? "s" : ""}`;

  const nInlop    = datos.destinatarios.personal_ids.length;
  const nExternos = datos.destinatarios.correos_externos.length;
  const resumenDestinatarios =
    `${nInlop} destinatario${nInlop !== 1 ? "s" : ""} INLOP · ` +
    `${nExternos} externo${nExternos !== 1 ? "s" : ""}`;

  return (
    <div className="flex gap-5 min-h-full">

      {/* ── IZQUIERDA — Resumen de configuración ──────────────────────────── */}
      <div className="flex flex-col gap-3" style={{ flex: "0 0 52%", minWidth: 0 }}>

        <div className="mb-0.5">
          <p className="font-semibold text-[14px]" style={{ color: "var(--navy)" }}>
            Revisión del reporte
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--gray-400)" }}>
            Verifica la configuración antes de activar.
          </p>
        </div>

        {/* 01 · Información básica */}
        <SeccionCard
          numero={1}
          titulo="Información básica"
          completa={infoCompleta}
          errorMsg={infoCompleta ? undefined : "Completa el Nombre y el Asunto del correo."}
          onEditar={() => onIrA("info-basica")}
        >
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--gray-700)" }}>
            {ib.nombre || "—"}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {[
              labelModulo(ib.modulo_id),
              labelTipoReporte(ib.tipo_reporte),
              labelFormato(ib.formato),
            ].map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: "var(--gray-200)", color: "var(--gray-600)" }}
              >
                {tag}
              </span>
            ))}
          </div>
          {ib.asunto && (
            <p
              className="text-[12px] mt-1.5 truncate"
              style={{ color: "var(--gray-500)" }}
              title={ib.asunto}
            >
              Asunto: {ib.asunto}
            </p>
          )}
        </SeccionCard>

        {/* 02 · Filtros — siempre válido (array vacío = sin filtros) */}
        <SeccionCard
          numero={2}
          titulo="Filtros"
          completa={true}
          onEditar={() => onIrA("filtros")}
        >
          <p className="text-[13px]" style={{ color: "var(--gray-600)" }}>
            {resumenFiltros}
          </p>
        </SeccionCard>

        {/* 03 · Columnas — siempre válido (vacío = todas por defecto) */}
        <SeccionCard
          numero={3}
          titulo="Columnas"
          completa={true}
          onEditar={() => onIrA("columnas")}
        >
          <p className="text-[13px]" style={{ color: "var(--gray-600)" }}>
            {resumenColumnas}
          </p>
        </SeccionCard>

        {/* 04 · Frecuencia */}
        <SeccionCard
          numero={4}
          titulo="Frecuencia"
          completa={frecuenciaCompleta}
          errorMsg={frecuenciaCompleta ? undefined : "Completa los campos requeridos de frecuencia."}
          onEditar={() => onIrA("frecuencia")}
        >
          <p className="text-[13px]" style={{ color: "var(--gray-600)" }}>
            {resumenFrecuencia(datos.frecuencia)}
          </p>
        </SeccionCard>

        {/* 05 · Destinatarios */}
        <SeccionCard
          numero={5}
          titulo="Destinatarios"
          completa={destinatariosCompleta}
          errorMsg={destinatariosCompleta ? undefined : "Selecciona al menos un destinatario."}
          onEditar={() => onIrA("destinatarios")}
        >
          <p className="text-[13px]" style={{ color: "var(--gray-600)" }}>
            {resumenDestinatarios}
          </p>
        </SeccionCard>

      </div>

      {/* ── DERECHA — Vista previa del correo ─────────────────────────────── */}
      <div
        className="flex-1 flex flex-col rounded-xl overflow-hidden"
        style={{
          minWidth:   0,
          minHeight:  "280px",
          border:     "1.5px solid var(--gray-200)",
          background: "var(--gray-50)",
        }}
      >
        {/* Cabecera del panel */}
        <div
          className="shrink-0 flex items-center gap-2 px-4 py-2.5"
          style={{
            borderBottom: "1.5px solid var(--gray-200)",
            background:   "var(--gray-50)",
          }}
        >
          <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
          <span
            className="text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: "var(--gray-500)" }}
          >
            Vista previa del correo
          </span>
          <span style={{ flex: "1 1 0" }} />
          <span className="text-[10.5px]" style={{ color: "var(--gray-400)" }}>
            Se actualiza con el wizard
          </span>
        </div>

        {/* Email preview — sin scroll propio, el wizard lo provee */}
        <div className="p-3">
          <PreviewCorreo
            datos={datos}
            totalColumnasCatalogo={totalColumnasCatalogo}
          />
        </div>
      </div>

    </div>
  );
}
