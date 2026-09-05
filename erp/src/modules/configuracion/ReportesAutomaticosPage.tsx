import { useState } from "react";
import { Mail, Plus, Pencil, Power, Send, Trash2, Settings2, Info } from "lucide-react";
import {
  PageHeader, FilterBar, DataTable, Button,
  Badge, SidePanel, PanelSection, InfoRow,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatearFecha } from "@/utils/date";
import { FormReporteAutomatico } from "./components/FormReporteAutomatico";
import { ModalEnviarReporte } from "./components/ModalEnviarReporte";
import { ModalEliminarReporte } from "./components/ModalEliminarReporte";
import { useReportesAutomaticos } from "./hooks/useReportesAutomaticos";
import {
  labelTipoReporte, labelFrecuencia, formatFechaCorta,
  type ReporteAutomatico,
} from "./types";

interface Props {
  onCrear: () => void;
  /** Abre el wizard de 6 etapas precargado — "Editar configuración completa" (Fase 9I). */
  onEditarCompleto: (reporte: ReporteAutomatico) => void;
  /**
   * Aviso no bloqueante (Fase 11D.1) traído desde el wizard tras crear/
   * activar/editar (el wizard se desmonta al navegar de vuelta aquí, así
   * que no puede mostrarlo por su cuenta — ver ConfiguracionPage.tsx).
   */
  avisoInicial?:      string | null;
  onAvisoConsumido?:  () => void;
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ conFiltro, onCrear }: { conFiltro: boolean; onCrear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-[var(--radius-2xl)] gap-3"
      style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--gray-100)" }}
      >
        <Mail className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
      </div>
      {conFiltro ? (
        <>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
            Sin resultados
          </p>
          <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
            Ningún reporte coincide con la búsqueda.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
            No hay reportes configurados
          </p>
          <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
            Crea el primer reporte automático para empezar.
          </p>
          <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={onCrear} className="mt-1">
            Crear reporte
          </Button>
        </>
      )}
    </div>
  );
}

// ── Toggle activo (con feedback de error silencioso) ─────────────────────────

function ToggleActivoBtn({
  reporte,
  onToggle,
}: {
  reporte: ReporteAutomatico;
  onToggle: (id: string, activo: boolean) => Promise<void>;
}) {
  const siguiente = !reporte.activo;
  return (
    <button
      type="button"
      title={siguiente ? "Activar" : "Desactivar"}
      aria-label={siguiente ? "Activar reporte" : "Desactivar reporte"}
      onClick={e => { e.stopPropagation(); onToggle(reporte.id, siguiente).catch(() => {}); }}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--gray-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
      style={{ color: reporte.activo ? "var(--gray-500)" : "var(--gray-300)" }}
    >
      <Power className="w-3.5 h-3.5" />
    </button>
  );
}

// ── Columnas de la tabla ──────────────────────────────────────────────────────

function buildColumns(
  onEditar:   (r: ReporteAutomatico) => void,
  onToggle:   (id: string, activo: boolean) => Promise<void>,
  onEnviar:   (r: ReporteAutomatico) => void,
  onEliminar: (r: ReporteAutomatico) => void,
): Column<ReporteAutomatico>[] {
  return [
    {
      key:    "nombre",
      header: "Nombre",
      width:  "220px",
      render: (r) => (
        <span className="font-medium text-[13px]" style={{ color: "var(--gray-800)" }}>
          {r.nombre}
        </span>
      ),
    },
    {
      key:    "tipo_reporte",
      header: "Reporte",
      width:  "160px",
      render: (r) => (
        <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>
          {labelTipoReporte(r.tipo_reporte)}
        </span>
      ),
    },
    {
      key:    "frecuencia",
      header: "Frecuencia",
      width:  "110px",
      render: (r) => (
        <span className="text-[13px]" style={{ color: "var(--gray-600)" }}>
          {labelFrecuencia(r.frecuencia)}
        </span>
      ),
    },
    {
      key:    "proxima_ejecucion",
      header: "Próxima ejecución",
      width:  "160px",
      render: (r) => (
        // Fase 11D.1 — fecha + hora (DD/MM/YYYY HH:mm), nunca solo fecha:
        // "próxima ejecución" sin hora no le dice al usuario si el slot de
        // hoy ya pasó. Reutiliza formatearFecha() (@/utils/date, estándar
        // corporativo) — no se reimplementa formato de fecha aquí.
        <span className="text-[13px]" style={{ color: "var(--gray-400)" }}>
          {formatearFecha(r.proxima_ejecucion, "completo")}
        </span>
      ),
    },
    {
      key:    "activo",
      header: "Estado",
      width:  "100px",
      render: (r) => (
        <Badge variant={r.activo ? "success" : "default"}>
          {r.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key:    "_acciones",
      header: "",
      width:  "124px",
      align:  "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <ToggleActivoBtn reporte={r} onToggle={onToggle} />
          <button
            type="button"
            title="Enviar ahora"
            aria-label="Enviar reporte ahora"
            onClick={e => { e.stopPropagation(); onEnviar(r); }}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--gray-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
            style={{ color: "var(--gray-500)" }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Editar"
            aria-label="Editar reporte"
            onClick={e => { e.stopPropagation(); onEditar(r); }}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--gray-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
            style={{ color: "var(--gray-500)" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Eliminar"
            aria-label="Eliminar reporte"
            onClick={e => { e.stopPropagation(); onEliminar(r); }}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
            style={{ color: "var(--gray-500)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];
}

// ── Página principal ──────────────────────────────────────────────────────────

export function ReportesAutomaticosPage({ onCrear, onEditarCompleto, avisoInicial, onAvisoConsumido }: Props) {
  const state = useReportesAutomaticos();
  const {
    filtrados, loading,
    busqueda, setBusqueda,
    panelId, setPanelId, panelReporte,
    guardando, toggleActivo, guardarEdicion, eliminar,
  } = state;

  const [reporteAEnviar,   setReporteAEnviar]   = useState<ReporteAutomatico | null>(null);
  const [reporteAEliminar, setReporteAEliminar] = useState<ReporteAutomatico | null>(null);
  // Fase 11D.1 — aviso no bloqueante: "la hora de hoy ya pasó, el próximo
  // envío es [fecha]". Nunca bloquea ni ejecuta nada, solo informa.
  // Se inicializa con el traído desde el wizard (crear/editar), si hay uno.
  const [avisoProgramacion, setAvisoProgramacion] = useState<string | null>(avisoInicial ?? null);

  function cerrarAviso() {
    setAvisoProgramacion(null);
    onAvisoConsumido?.();
  }

  async function handleToggle(id: string, activo: boolean) {
    const resultado = await toggleActivo(id, activo);
    if (resultado.slotDeHoyVencido && resultado.proxima_ejecucion) {
      setAvisoProgramacion(
        `La hora programada de hoy ya pasó. El próximo envío será el ${formatearFecha(resultado.proxima_ejecucion, "fecha")} a las ${formatearFecha(resultado.proxima_ejecucion, "hora")}.`
      );
    }
  }

  const columns = buildColumns(
    (r) => setPanelId(r.id),
    handleToggle,
    (r) => setReporteAEnviar(r),
    (r) => setReporteAEliminar(r),
  );

  const hayBusqueda = busqueda.trim().length > 0;

  return (
    <div className="p-6 flex flex-col gap-6">

      {/* Header + acción principal */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Reportes Automáticos"
          subtitle="Configura reportes que el ERP genera y envía automáticamente."
          icon={<Mail className="w-5 h-5" />}
        />
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={onCrear}
          className="shrink-0"
        >
          Crear reporte
        </Button>
      </div>

      {/* Aviso no bloqueante (Fase 11D.1) — nunca ejecuta nada, solo informa */}
      {avisoProgramacion && (
        <div
          className="flex items-start gap-2.5 text-[12.5px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", color: "var(--gray-500)", border: "1px solid var(--gray-100)" }}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--gray-400)" }} />
          <span className="flex-1">{avisoProgramacion}</span>
          <button
            type="button"
            onClick={cerrarAviso}
            className="text-[11.5px] font-medium shrink-0 hover:underline"
            style={{ color: "var(--gray-500)" }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <FilterBar
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        searchPlaceholder="Buscar por nombre..."
        hayFiltros={hayBusqueda}
        onLimpiar={hayBusqueda ? () => setBusqueda("") : undefined}
      />

      {/* Tabla o empty state */}
      {!loading && filtrados.length === 0 ? (
        <EmptyState conFiltro={hayBusqueda} onCrear={onCrear} />
      ) : (
        <DataTable<ReporteAutomatico>
          columns={columns}
          rows={filtrados}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Sin reportes"
        />
      )}

      {/* Panel de edición */}
      <SidePanel
        open={panelId !== null}
        onClose={() => setPanelId(null)}
        title="Editar reporte"
        subtitle={panelReporte?.nombre}
        width="440px"
      >
        {panelReporte && (
          <div className="p-5">
            <PanelSection first>
              <div className="mb-5 flex flex-col gap-1">
                <InfoRow label="Creado"   value={formatFechaCorta(panelReporte.created_at)} />
                <InfoRow label="Editado"  value={formatFechaCorta(panelReporte.updated_at)} />
                {panelReporte.created_by && (
                  <InfoRow label="Por" value={panelReporte.created_by} />
                )}
              </div>

              {/* Edición rápida de Información básica (Nombre, Asunto, Cuerpo,
                  entre otros campos de la Etapa 01) — UX sin cambios. */}
              <FormReporteAutomatico
                inicial={panelReporte}
                guardando={guardando}
                onGuardar={(datos) => guardarEdicion(panelReporte.id, datos)}
                onCancelar={() => setPanelId(null)}
              />

              {/* Editar configuración completa (Fase 9I): abre el mismo wizard
                  de 6 etapas usado para crear, precargado con TODOS los datos
                  del reporte — filtros, columnas, frecuencia y destinatarios
                  incluidos, no solo la Información básica de arriba. */}
              <div
                className="mt-5 pt-4 flex flex-col gap-2"
                style={{ borderTop: "1px solid var(--gray-100)" }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Settings2 className="w-3.5 h-3.5" />}
                  onClick={() => onEditarCompleto(panelReporte)}
                  className="w-full"
                >
                  Editar configuración completa
                </Button>
                <p className="text-[11.5px]" style={{ color: "var(--gray-400)" }}>
                  Filtros, columnas, frecuencia y destinatarios — el asistente
                  completo de creación, precargado con este reporte.
                </p>
              </div>
            </PanelSection>
          </div>
        )}
      </SidePanel>

      {/* Confirmación + ejecución de "Enviar ahora" (Fase 9E) */}
      {reporteAEnviar && (
        <ModalEnviarReporte
          reporte={reporteAEnviar}
          onClose={() => setReporteAEnviar(null)}
        />
      )}

      {/* Confirmación + eliminación definitiva (Fase 9I) */}
      {reporteAEliminar && (
        <ModalEliminarReporte
          reporte={reporteAEliminar}
          onEliminar={eliminar}
          onClose={() => setReporteAEliminar(null)}
        />
      )}

    </div>
  );
}
