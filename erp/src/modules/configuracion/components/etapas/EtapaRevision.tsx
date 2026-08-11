/**
 * Etapa 06 — Revisión y activación
 *
 * Layout dos columnas:
 *   IZQUIERDA: resumen compacto de las 5 etapas con botón "Editar" por sección.
 *   DERECHA:   panel placeholder para futura vista previa del correo/reporte.
 *
 * Principios:
 *  - NO lista ítems individuales (filtros, columnas, destinatarios) — solo conteos.
 *  - NO hace fetch de /api/personal — los ids son suficientes para el conteo.
 *  - `onIrA` delega la navegación al ConfiguradorReporte (única fuente de verdad).
 */
import { type ReactNode }                    from "react";
import { CheckCircle2, AlertCircle, Pencil, Eye } from "lucide-react";
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

// ─── Componente principal ─────────────────────────────────────────────────────

export function EtapaRevision({ datos, onIrA }: Props) {
  const ib = datos.infoBasica;

  const infoCompleta          = etapaInfoBasicaCompleta(ib);
  const frecuenciaCompleta    = etapaFrecuenciaCompleta(datos.frecuencia);
  const destinatariosCompleta = etapaDestinatariosCompleta(datos.destinatarios);

  // Total de columnas seleccionables del catálogo de este reporte
  const totalColumnasCatalogo = buscarReporte(ib.tipo_reporte)
    ?.campos.filter(c => c.seleccionableColumna).length ?? 0;

  // ── Resúmenes de una línea ─────────────────────────────────────────────────

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

      {/* ── DERECHA — Placeholder para futura vista previa ────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center rounded-xl"
        style={{
          minWidth:   0,
          minHeight:  "280px",
          border:     "1.5px dashed var(--gray-200)",
          background: "var(--gray-50)",
        }}
      >
        <div
          className="flex flex-col items-center gap-3 text-center"
          style={{ maxWidth: "260px" }}
        >
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width:      "44px",
              height:     "44px",
              background: "var(--gray-200)",
              color:      "var(--gray-400)",
            }}
          >
            <Eye style={{ width: "20px", height: "20px" }} />
          </div>
          <p className="font-semibold text-[14px]" style={{ color: "var(--gray-600)" }}>
            Vista previa
          </p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--gray-400)" }}>
            La vista previa del correo y del reporte aparecerá aquí en una próxima versión.
          </p>
        </div>
      </div>

    </div>
  );
}
