import { useEffect, useState } from "react";
import {
  User, Truck, Calendar, FileText, AlertCircle, ChevronRight,
  CalendarClock, Phone, MessageCircle, CheckCircle, Link2, ClipboardCheck,
} from "lucide-react";
import { fmtFecha, fmtFechaCort, fmtHora } from "@/utils/date";
import { SidePanel, PanelSection, InfoRow, Button } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { Solicitud, SolicitudDetalle as SolicitudDetalleType } from "../types";
import { getSolicitudDetalle } from "../services/api";
import { EstadoBadge } from "./EstadoBadge";
import { CanalBadge } from "./CanalBadge";
import { ProgressBar } from "@/modules/viajes/components/ProgressBar";

interface DetalleSolicitudProps {
  solicitud: Solicitud;
  onClose:   () => void;
  onEstado:  (id: string, estado: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Ciclo Operativo — timeline vertical con fechas reales
// ---------------------------------------------------------------------------
interface CicloStep {
  label:     string;
  fecha:     string | null | undefined;
  isDone:    boolean;
  isActive:  boolean;
  dotColor:  string;
  bgColor:   string;
  textColor: string;
}

function CicloOperativo({
  d,
  estadoActual,
  creado_en,
}: {
  d:            SolicitudDetalleType | null;
  estadoActual: string;
  creado_en:    string;
}) {
  const isCancelado = estadoActual === "cancelado";

  const steps: CicloStep[] = [
    {
      label:     "Solicitud recibida",
      fecha:     creado_en,
      isDone:    true,
      isActive:  estadoActual === "pendiente",
      dotColor:  estadoActual === "pendiente" ? "#D97706" : "#059669",
      bgColor:   estadoActual === "pendiente" ? "#FEF3C7" : "#D1FAE5",
      textColor: estadoActual === "pendiente" ? "#B45309" : "var(--gray-700)",
    },
    {
      label:     "Aprobada",
      fecha:     d?.fecha_confirmacion,
      isDone:    !!d?.fecha_confirmacion,
      isActive:  estadoActual === "aprobado",
      dotColor:  "#1D4ED8",
      bgColor:   "#DBEAFE",
      textColor: "#1D4ED8",
    },
    {
      label:     "Programada",
      fecha:     d?.fecha_programada,
      isDone:    !!d?.fecha_programada,
      isActive:  false,
      dotColor:  "#6D28D9",
      bgColor:   "#EDE9FE",
      textColor: "#6D28D9",
    },
    {
      label:     "En ruta",
      fecha:     d?.fecha_inicio_ruta,
      isDone:    !!d?.fecha_inicio_ruta,
      isActive:  estadoActual === "en_ruta",
      dotColor:  "#059669",
      bgColor:   "#D1FAE5",
      textColor: "#059669",
    },
    ...(isCancelado
      ? [{
          label:     "Cancelada",
          fecha:     d?.fecha_cancelacion,
          isDone:    !!d?.fecha_cancelacion,
          isActive:  true,
          dotColor:  "#E30613",
          bgColor:   "#FFE4E6",
          textColor: "#9F1239",
        }]
      : [{
          label:     "Completada",
          fecha:     d?.fecha_fin_ruta,
          isDone:    !!d?.fecha_fin_ruta,
          isActive:  estadoActual === "completado",
          dotColor:  "#059669",
          bgColor:   "#D1FAE5",
          textColor: "#065F46",
        }]
    ),
  ];

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, idx) => {
        const isLast    = idx === steps.length - 1;
        const lineColor = step.isDone && !step.isActive ? "#D1FAE5" : "var(--gray-100)";

        return (
          <div key={step.label} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
              <div
                className="h-5 w-5 rounded-full flex items-center justify-center z-10 shrink-0"
                style={{
                  background: step.isDone ? step.bgColor : "var(--gray-100)",
                  border:     step.isActive ? `2px solid ${step.dotColor}` : "2px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {step.isDone && !step.isActive && (
                  <CheckCircle className="w-3 h-3" style={{ color: step.dotColor }} />
                )}
                {step.isActive && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: step.dotColor }} />
                )}
                {!step.isDone && !step.isActive && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gray-300)" }} />
                )}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 min-h-[16px]"
                  style={{ background: lineColor, marginTop: 2 }}
                />
              )}
            </div>

            <div className="pb-3 min-w-0 flex-1">
              <div
                className="text-[12px] font-semibold"
                style={{
                  color: step.isActive
                    ? step.textColor
                    : step.isDone
                    ? "var(--gray-700)"
                    : "var(--gray-300)",
                }}
              >
                {step.label}
              </div>
              {step.fecha ? (
                <div className="text-[11px] mt-0.5 tabular-nums leading-snug" style={{ color: "var(--gray-400)" }}>
                  {fmtFecha(step.fecha)}
                </div>
              ) : (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-300)" }}>
                  Pendiente
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — construye link de WhatsApp a partir de un número de teléfono
// ---------------------------------------------------------------------------
function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const num = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${num}`;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function DetalleSolicitud({ solicitud, onClose, onEstado }: DetalleSolicitudProps) {
  const { navigateTo } = useNavigationContext();
  const [detalle, setDetalle]               = useState<SolicitudDetalleType | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(true);
  const [accionLoading, setAccionLoading]   = useState(false);
  const [errorDetalle, setErrorDetalle]     = useState<string | null>(null);
  const [accionError, setAccionError]       = useState<string | null>(null);

  useEffect(() => {
    setLoadingDetalle(true);
    setErrorDetalle(null);
    getSolicitudDetalle(solicitud.id)
      .then(setDetalle)
      .catch((e) => {
        setErrorDetalle(e instanceof Error ? e.message : "Error al cargar detalle");
        setDetalle(null);
      })
      .finally(() => setLoadingDetalle(false));
  }, [solicitud.id]);

  const accion = async (estado: string) => {
    setAccionLoading(true);
    setAccionError(null);
    try {
      await onEstado(solicitud.id, estado);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (/403|401|permiso|autorizado/i.test(raw)) {
        setAccionError("No tienes permiso para realizar esta acción. Contacta a tu administrador.");
      } else if (/409|conflict|modificado/i.test(raw)) {
        setAccionError("Esta solicitud fue modificada por otro operador. Cierra el panel y recarga la lista.");
      } else if (/network|failed to fetch|timeout/i.test(raw)) {
        setAccionError("No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.");
      } else {
        setAccionError("No fue posible completar la acción. Intenta de nuevo en unos momentos.");
      }
    } finally {
      setAccionLoading(false);
    }
  };

  const d          = detalle;
  const tripNumber = d?.controlt_trip_number ?? null;

  const footer = (solicitud.estado === "pendiente" || solicitud.estado === "aprobado") ? (
    <div className="px-6 py-4 flex flex-col gap-2.5">
      {accionError && (
        <div
          className="flex items-start gap-2 text-[12px] px-3 py-2.5 rounded-xl"
          style={{ background: "var(--danger-bg)", color: "#9F1239", border: "1px solid var(--danger)" }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {accionError}
        </div>
      )}
      {solicitud.estado === "pendiente" && (
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={accionLoading}
          onClick={() => accion("aprobado")}
        >
          ✓ Aprobar solicitud
        </Button>
      )}
      <Button
        variant="danger"
        size="lg"
        className="w-full justify-center"
        loading={accionLoading}
        onClick={() => accion("cancelado")}
      >
        ✕ Cancelar solicitud
      </Button>
    </div>
  ) : null;

  return (
    <SidePanel
      open
      onClose={onClose}
      title={solicitud.codigo_solicitud}
      subtitle={solicitud.external_ref ? `Ref. ${solicitud.external_ref}` : undefined}
      headerRight={<EstadoBadge estado={solicitud.estado} />}
      footer={footer}
      width="480px"
    >

      {/* ── SECCIÓN 1: Solicitud ── */}
      <PanelSection title="Solicitud" icon={<FileText className="w-3.5 h-3.5" />} first>

        {/* Cita de cargue — fecha y hora con igual protagonismo visual */}
        <div
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl mb-3"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          <CalendarClock className="w-5 h-5 shrink-0" style={{ opacity: 0.6 }} />
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-wide mb-2"
              style={{ opacity: 0.6 }}
            >
              Cita de cargue
            </div>
            <div className="flex items-start gap-3 tabular-nums">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ opacity: 0.5 }}>Fecha</div>
                <div className="text-[14px] font-bold leading-none">{fmtFechaCort(solicitud.fecha_requerida)}</div>
              </div>
              <div className="w-px self-stretch mx-0.5" style={{ background: "rgba(255,255,255,0.2)" }} />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ opacity: 0.5 }}>Hora</div>
                <div className="text-[14px] font-bold leading-none">{fmtHora(solicitud.fecha_requerida)}</div>
              </div>
            </div>
          </div>
        </div>

        <InfoRow label="Fecha solicitud" value={fmtFecha(solicitud.creado_en)} />
        <InfoRow label="Cliente"         value={solicitud.cliente} />
        <InfoRow label="Agencia"         value={solicitud.agencia} />
        <InfoRow label="Solicitante"     value={solicitud.solicitante ?? "No registrado"} />
        <InfoRow label="Canal"           value={<CanalBadge canal={solicitud.canal} />} />
        <InfoRow label="Tipo servicio"   value={solicitud.tipo_operacion === "urbana" ? "Urbana" : "Nacional"} />
        <InfoRow label="Tipo vehículo"   value={solicitud.tipo_vehiculo} />

        {/* Ruta origen → destino */}
        <div
          className="flex items-center gap-2.5 mt-3 px-3 py-3 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
            <div className="w-0.5 h-5"                     style={{ background: "var(--gray-200)" }} />
            <div className="w-2 h-2 rounded-full"          style={{ background: "var(--inlop-red)" }} />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
              <div className="text-[13px] font-bold truncate"                     style={{ color: "var(--gray-800)" }}>{solicitud.origen}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate"                     style={{ color: "var(--gray-800)" }}>{solicitud.destino}</div>
            </div>
          </div>
        </div>

        {/* Observaciones del coordinador */}
        {d?.notas && (
          <div
            className="text-[12px] mt-3 px-3 py-2.5 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-600)", border: "1px solid var(--gray-100)" }}
          >
            {d.notas}
          </div>
        )}
      </PanelSection>

      {/* ── SECCIÓN 2: Asignación ── */}
      <PanelSection title="Asignación" icon={<Truck className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando…</div>
        ) : errorDetalle ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--gray-400)" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            No se pudo obtener información de asignación
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Conductor */}
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--gray-400)" }}
              >
                Conductor
              </div>
              {d?.conductor_nombre ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
                >
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                    style={{ background: "var(--navy)", color: "#fff" }}
                  >
                    {d.conductor_nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>
                      {d.conductor_nombre}
                    </div>
                    {d.conductor_telefono && (
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                        {d.conductor_telefono}
                      </div>
                    )}
                  </div>
                  {d.conductor_telefono && (
                    <div className="flex gap-1.5 shrink-0">
                      <a
                        href={`tel:${d.conductor_telefono}`}
                        className="h-7 w-7 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gray-100)", color: "var(--gray-600)" }}
                        title="Llamar"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                      {waLink(d.conductor_telefono) && (
                        <a
                          href={waLink(d.conductor_telefono)!}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 w-7 rounded-full flex items-center justify-center"
                          style={{ background: "#DCFCE7", color: "#15803D" }}
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
                  style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  Sin conductor asignado
                </div>
              )}
            </div>

            {/* Vehículo */}
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--gray-400)" }}
              >
                Vehículo
              </div>
              {d?.vehiculo_placa ? (
                <div
                  className="px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
                >
                  <div
                    className="text-[18px] font-bold tracking-widest font-mono"
                    style={{ color: "var(--navy)" }}
                  >
                    {d.vehiculo_placa}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                    {solicitud.tipo_vehiculo}
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
                  style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  Sin vehículo asignado
                </div>
              )}
            </div>

            {/* Trip Number */}
            {tripNumber && <InfoRow label="Trip Number" value={tripNumber} mono />}

            {/* Progreso del viaje */}
            {d?.pct != null && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] shrink-0" style={{ color: "var(--gray-500)" }}>Progreso</span>
                <ProgressBar value={d.pct} maxWidth="120px" />
              </div>
            )}

          </div>
        )}
      </PanelSection>

      {/* ── SECCIÓN 3: Conexiones ── */}
      <PanelSection title="Conexiones" icon={<Link2 className="w-3.5 h-3.5" />}>
        <div className="flex flex-col gap-2">

          {/* Ver en Programación */}
          {(() => {
            const activo = !loadingDetalle && (d?.in_programacion ?? false) && !!tripNumber;
            return (
              <button
                type="button"
                disabled={!activo}
                onClick={() => activo && navigateTo(navActions.verProgramacion(tripNumber!, "solicitudes"))}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium"
                style={{
                  background: activo ? "#fff" : "var(--gray-50)",
                  color:      activo ? "var(--gray-700)" : "var(--gray-300)",
                  border:     `1.5px solid ${activo ? "var(--gray-200)" : "var(--gray-100)"}`,
                  cursor:     activo ? "pointer" : "not-allowed",
                }}
              >
                <span className="flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Ver en Programación
                </span>
                <ChevronRight
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: activo ? "var(--gray-400)" : "var(--gray-200)" }}
                />
              </button>
            );
          })()}

          {/* Ver en Viajes (en_ruta) o Ver en Viajes Finalizados (completado) */}
          {!loadingDetalle && (
            d?.in_viajes ? (
              <button
                type="button"
                disabled={!tripNumber}
                onClick={() => tripNumber && navigateTo(navActions.verViaje(tripNumber, "solicitudes"))}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium"
                style={{
                  background: "#fff",
                  color:      "var(--gray-700)",
                  border:     "1.5px solid var(--gray-200)",
                  cursor:     "pointer",
                }}
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" />
                  Ver en Viajes
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
              </button>
            ) : d?.in_cumplidos ? (
              <button
                type="button"
                disabled={!tripNumber}
                onClick={() => tripNumber && navigateTo(navActions.verCumplidos(tripNumber, "solicitudes"))}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium"
                style={{
                  background: "#fff",
                  color:      "var(--gray-700)",
                  border:     "1.5px solid var(--gray-200)",
                  cursor:     "pointer",
                }}
              >
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Ver en Viajes Finalizados
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
              </button>
            ) : tripNumber ? (
              <div
                className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
                style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                Viaje no encontrado en caché activa ni en histórico.
              </div>
            ) : null
          )}

          {!tripNumber && !loadingDetalle && (
            <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>
              Sin correlación operativa registrada.
            </div>
          )}
        </div>
      </PanelSection>

      {/* ── SECCIÓN 4: Ciclo Operativo ── */}
      <PanelSection title="Ciclo operativo" icon={<Calendar className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando…</div>
        ) : (
          <CicloOperativo
            d={d}
            estadoActual={solicitud.estado}
            creado_en={solicitud.creado_en}
          />
        )}
      </PanelSection>

    </SidePanel>
  );
}
