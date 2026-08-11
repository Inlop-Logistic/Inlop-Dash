/**
 * Etapa 06 — Revisión y activación
 *
 * Layout dos filas:
 *   FILA SUPERIOR (flex):
 *     IZQUIERDA: resumen compacto de las 5 etapas con botón "Editar" por sección.
 *     DERECHA:   vista previa del correo (Fase 8B).
 *   FILA INFERIOR (full-width):
 *     Muestra de datos real del reporte seleccionado, con `datos.filtros` y
 *     `datos.columnas` del wizard ya aplicados (Fase 8C + 8D).
 *
 * Principios:
 *  - Todo se deriva de `datos` o se consulta en tiempo real — sin datos inventados.
 *  - NO lista ítems individuales en las secciones de resumen — solo conteos.
 *  - NO hace fetch de /api/personal (conteo con .length).
 *  - Email preview: pura, stateless, sin fetch.
 *  - Tabla de datos: carga real, filtrada por `datos.filtros` y proyectada
 *    según `datos.columnas` (título y orden); máx. 10 filas.
 *  - `onIrA` delega la navegación al ConfiguradorReporte (única fuente de verdad).
 */
import { useState, useEffect, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Pencil,
         Mail, FileSpreadsheet, FileCode,
         Loader2, Database, AlertTriangle }          from "lucide-react";
import {
  labelModulo, labelTipoReporte, labelFormato, labelFrecuencia,
  etapaInfoBasicaCompleta, etapaFrecuenciaCompleta, etapaDestinatariosCompleta,
  DIAS_SEMANA,
  type DatosConfigurador,
  type EtapaId,
  type FinRecurrencia,
  type RecurrenciaReporte,
  type FiltroItem,
  type ColumnaReporte,
} from "../../types";
import { buscarReporte, type CampoDataset } from "../../catalogos/datasetsReportes";
import { cargarPreviewReporte }              from "../../services/api";

interface Props {
  datos: DatosConfigurador;
  /** Navega a la etapa indicada — delegado al ConfiguradorReporte. */
  onIrA: (id: EtapaId) => void;
}

// ─── Helpers de resumen ────────────────────────────────────────────────────────

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

// ─── Helper de formato de celda ───────────────────────────────────────────────

/** Convierte un valor arbitrario de API en texto legible para la tabla de preview. */
function formatCelda(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  const s = String(valor);
  // ISO date o datetime: "YYYY-MM-DD..."
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const part = s.slice(0, 10);
    const [y, m, d] = part.split("-");
    return d && m && y ? `${d}/${m}/${y}` : s;
  }
  return s;
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

interface PreviewCorreoProps {
  datos:                DatosConfigurador;
  totalColumnasCatalogo: number;
}

function PreviewCorreo({ datos, totalColumnasCatalogo }: PreviewCorreoProps) {
  const ib = datos.infoBasica;

  const nInlop    = datos.destinatarios.personal_ids.length;
  const nExternos = datos.destinatarios.correos_externos.length;
  const hayDestinatarios = nInlop + nExternos > 0;
  const paraLabel = hayDestinatarios
    ? `${nInlop} destinatario${nInlop !== 1 ? "s" : ""} INLOP · ${nExternos} externo${nExternos !== 1 ? "s" : ""}`
    : "Sin destinatarios configurados";

  const ext         = EXT_FORMATO[ib.formato] ?? "xlsx";
  const reporteSlug = labelTipoReporte(ib.tipo_reporte).replace(/\s+/g, "_");
  const adjNombre   = `${reporteSlug}.${ext}`;
  const nCols       = datos.columnas.length === 0 ? totalColumnasCatalogo : datos.columnas.length;
  const adjDetalle  = `${nCols} columna${nCols !== 1 ? "s" : ""} · ${labelFormato(ib.formato)}`;
  const esExcel     = ib.formato === "excel";

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
      <FilaEmail etiqueta="De">
        Sistema de Reportes INLOP
      </FilaEmail>

      <FilaEmail etiqueta="Para" danger={!hayDestinatarios}>
        {hayDestinatarios ? paraLabel : <span className="italic">{paraLabel}</span>}
      </FilaEmail>

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

      <div
        className="px-4 py-3"
        style={{ minHeight: "60px", borderBottom: "1px solid var(--gray-100)" }}
      >
        {ib.cuerpo.trim() ? (
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: "var(--gray-700)" }}>
            {ib.cuerpo}
          </p>
        ) : (
          <p className="text-[13px] italic" style={{ color: "var(--gray-400)" }}>
            Sin cuerpo de mensaje — se enviará solo el archivo adjunto.
          </p>
        )}
      </div>

      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)" }}
        >
          <div
            className="shrink-0 flex items-center justify-center rounded-md"
            style={{
              width:      "30px",
              height:     "30px",
              background: esExcel ? "rgba(21,128,61,0.10)" : "rgba(37,99,235,0.10)",
              color:      esExcel ? "#15803d" : "#2563eb",
            }}
          >
            {esExcel
              ? <FileSpreadsheet style={{ width: "14px", height: "14px" }} />
              : <FileCode        style={{ width: "14px", height: "14px" }} />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--gray-700)" }} title={adjNombre}>
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

// ─── Resolución de columnas (Fase 8D) ──────────────────────────────────────────

interface ColumnaResuelta {
  campo:  string;
  titulo: string;
}

/**
 * Resuelve qué columnas mostrar y con qué título, a partir de `datos.columnas`
 * (Etapa 03) — única fuente de verdad, sin redefinir catálogo propio:
 *   - columnas = [] (o ninguna válida para este reporte) → todas las
 *     seleccionableColumna del catálogo, en su orden y con su label.
 *   - columnas configuradas → filtradas a las válidas para este reporte,
 *     ordenadas por `orden`, con el `titulo` personalizado del usuario.
 */
function resolverColumnas(tipoReporte: string, columnas: ColumnaReporte[]): ColumnaResuelta[] {
  const disponibles: CampoDataset[] =
    buscarReporte(tipoReporte)?.campos.filter(c => c.seleccionableColumna) ?? [];
  const porKey = new Map(disponibles.map(c => [c.key, c]));

  const validas = columnas.filter(c => porKey.has(c.campo));
  if (validas.length === 0) {
    return disponibles.map(c => ({ campo: c.key, titulo: c.label }));
  }

  return [...validas]
    .sort((a, b) => a.orden - b.orden)
    .map(c => ({ campo: c.campo, titulo: c.titulo }));
}

// ─── PreviewTabla ─────────────────────────────────────────────────────────────
//
// Consulta el dataset real del reporte seleccionado, aplica `datos.filtros`
// (Etapa 02) y muestra hasta 10 registros usando `datos.columnas` (Etapa 03)
// — mismas columnas, títulos y orden que el reporte final.
//
// Se re-ejecuta automáticamente al cambiar `tipo_reporte` o `filtros`:
//   - Limpia filas anteriores de inmediato.
//   - Muestra estado "cargando" mientras espera.
//   - Maneja vacío y error sin propagar al wizard.
// El cambio de `columnas` es puramente de presentación — no dispara refetch.

type EstadoTabla = "cargando" | "ok" | "vacio" | "error";

interface PreviewTablaProps {
  tipoReporte: string;
  filtros:     FiltroItem[];
  columnas:    ColumnaReporte[];
}

function PreviewTabla({ tipoReporte, filtros, columnas }: PreviewTablaProps) {
  const [estado,   setEstado]   = useState<EstadoTabla>("cargando");
  const [filas,    setFilas]    = useState<Record<string, unknown>[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clave estable para detectar cambios reales de contenido en `filtros`
  // (filtros configurados en otra etapa, al volver a Revisión).
  const filtrosKey = JSON.stringify(filtros);

  useEffect(() => {
    let activo = true;
    setEstado("cargando");
    setFilas([]);
    setErrorMsg(null);

    cargarPreviewReporte(tipoReporte, filtros)
      .then(datos => {
        if (!activo) return;
        if (datos.length === 0) {
          setEstado("vacio");
        } else {
          setFilas(datos);
          setEstado("ok");
        }
      })
      .catch(err => {
        if (!activo) return;
        setErrorMsg((err as Error).message ?? "Error desconocido");
        setEstado("error");
      });

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoReporte, filtrosKey]);

  // Columnas a mostrar: datos.columnas si hay configuración válida, si no
  // todas las seleccionableColumna del catálogo (Fase 8C).
  const cols = resolverColumnas(tipoReporte, columnas);

  const hayFiltrosActivos = filtros.some(f => f.campo);
  const labelReporte = labelTipoReporte(tipoReporte);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1.5px solid var(--gray-200)" }}
    >
      {/* Cabecera */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          borderBottom: "1.5px solid var(--gray-200)",
          background:   "var(--gray-50)",
        }}
      >
        <Database className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
        <span
          className="text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: "var(--gray-500)" }}
        >
          Muestra de datos · {labelReporte}
        </span>
        <span style={{ flex: "1 1 0" }} />
        {hayFiltrosActivos && (
          <span
            className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ color: "var(--navy)", background: "rgba(1, 42, 107, 0.08)" }}
          >
            Filtros aplicados
          </span>
        )}
        {estado === "ok" && (
          <span className="text-[10.5px]" style={{ color: "var(--gray-400)" }}>
            {filas.length} registro{filas.length !== 1 ? "s" : ""} · máx. 10
          </span>
        )}
      </div>

      {/* Cuerpo */}
      {estado === "cargando" && (
        <div
          className="flex items-center justify-center gap-2 py-10"
          style={{ color: "var(--gray-400)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Cargando datos de {labelReporte}…</span>
        </div>
      )}

      {estado === "error" && (
        <div
          className="flex items-center gap-2.5 px-5 py-8"
          style={{ color: "var(--inlop-red)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-[13px] font-medium">No se pudieron cargar los datos</p>
            {errorMsg && (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--gray-500)" }}>
                {errorMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {estado === "vacio" && (
        <div
          className="flex items-center justify-center gap-2 py-10"
          style={{ color: "var(--gray-400)" }}
        >
          <Database className="w-4 h-4" />
          <span className="text-[13px]">
            {hayFiltrosActivos
              ? "Sin registros que cumplan los filtros configurados"
              : "Sin registros para el período actual"}
          </span>
        </div>
      )}

      {estado === "ok" && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width:           "100%",
              borderCollapse:  "collapse",
              tableLayout:     "auto",
            }}
          >
            <thead>
              <tr style={{ background: "var(--gray-50)", borderBottom: "1.5px solid var(--gray-200)" }}>
                {cols.map(c => (
                  <th
                    key={c.campo}
                    style={{
                      padding:       "7px 12px",
                      textAlign:     "left",
                      fontSize:      "10.5px",
                      fontWeight:    700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color:         "var(--gray-500)",
                      whiteSpace:    "nowrap",
                      borderRight:   "1px solid var(--gray-100)",
                    }}
                  >
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid var(--gray-100)",
                    background:   idx % 2 === 0 ? "#fff" : "var(--gray-50)",
                  }}
                >
                  {cols.map(c => (
                    <td
                      key={c.campo}
                      style={{
                        padding:       "6px 12px",
                        fontSize:      "12.5px",
                        color:         "var(--gray-700)",
                        whiteSpace:    "nowrap",
                        maxWidth:      "200px",
                        overflow:      "hidden",
                        textOverflow:  "ellipsis",
                        borderRight:   "1px solid var(--gray-100)",
                      }}
                      title={String(fila[c.campo] ?? "")}
                    >
                      {formatCelda(fila[c.campo])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EtapaRevision({ datos, onIrA }: Props) {
  const ib = datos.infoBasica;

  const infoCompleta          = etapaInfoBasicaCompleta(ib);
  const frecuenciaCompleta    = etapaFrecuenciaCompleta(datos.frecuencia);
  const destinatariosCompleta = etapaDestinatariosCompleta(datos.destinatarios);

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
    <div className="flex flex-col gap-5">

      {/* ── FILA SUPERIOR: resumen + preview correo ───────────────────────── */}
      <div className="flex gap-5">

        {/* IZQUIERDA — Resumen de configuración */}
        <div className="flex flex-col gap-3" style={{ flex: "0 0 52%", minWidth: 0 }}>

          <div className="mb-0.5">
            <p className="font-semibold text-[14px]" style={{ color: "var(--navy)" }}>
              Revisión del reporte
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              Verifica la configuración antes de activar.
            </p>
          </div>

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

        {/* DERECHA — Vista previa del correo (Fase 8B) */}
        <div
          className="flex-1 flex flex-col rounded-xl overflow-hidden"
          style={{
            minWidth:   0,
            border:     "1.5px solid var(--gray-200)",
            background: "var(--gray-50)",
          }}
        >
          <div
            className="shrink-0 flex items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: "1.5px solid var(--gray-200)", background: "var(--gray-50)" }}
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

          <div className="p-3">
            <PreviewCorreo
              datos={datos}
              totalColumnasCatalogo={totalColumnasCatalogo}
            />
          </div>
        </div>

      </div>

      {/* ── FILA INFERIOR: tabla de datos real (Fase 8C/8D) ────────────────── */}
      {/* key={tipo_reporte} garantiza que el componente se desmonta y remonta
          al cambiar de reporte — limpia estado, filtros y columnas anteriores
          sin condición extra. */}
      <PreviewTabla
        key={ib.tipo_reporte}
        tipoReporte={ib.tipo_reporte}
        filtros={datos.filtros}
        columnas={datos.columnas}
      />

    </div>
  );
}
