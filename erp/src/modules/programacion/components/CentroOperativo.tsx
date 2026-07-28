import { useEffect, useState } from "react";
import {
  User, Car, MapPin, FileText, Link2, CheckCircle2,
  RefreshCw, AlertTriangle, Truck, Map, ChevronRight, Phone, X,
} from "lucide-react";
import { parseFechaTMS } from "@/utils/parseFecha";
import { SidePanel, PanelSection, InfoRow, Button } from "@/components/ui";
import { useNavigationContext, navActions } from "@/core/navigation";
import type { ViajeResumen, EstadoProgramacion, SolicitudVinculadaResult } from "../types";
import { guardarObservacion, obtenerSolicitudVinculada } from "../services/api";
import { EstadoBadge } from "./EstadoBadge";
import { estadoVisual } from "../constants";

// ── Helpers locales ────────────────────────────────────────────────────

function formatTelUri(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function formatWaUri(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${number}`;
}

function lineaNegocio(raw: string | null | undefined): string {
  if (!raw) return "Carga Seca";
  return raw.trim().toLowerCase() === "granel liquido" ? "Carga Líquida" : "Carga Seca";
}

/** Extrae fecha DD/MM/YYYY y hora HH:mm de un string TMS DMY, en hora Colombia. */
function splitSchedulate(raw: string | null | undefined): { fecha: string; hora: string } {
  if (!raw) return { fecha: "—", hora: "" };
  const d = parseFechaTMS(raw, "DMY");
  if (!d) return { fecha: "—", hora: "" };
  const fecha = d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric",
  });
  const hora = d.toLocaleTimeString("en-US", {
    timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return { fecha, hora };
}

/** Icono oficial de WhatsApp. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Catálogo de motivos de cancelación ────────────────────────────────

const MOTIVOS_CANCELACION = [
  "Usuario no acepta",
  "Cancelación del cliente",
  "Vehículo no disponible",
  "Conductor no disponible",
  "Problema mecánico",
  "Condiciones climáticas",
  "Otro",
] as const;

type MotivoCancelacion = typeof MOTIVOS_CANCELACION[number];

// ── Componente principal ───────────────────────────────────────────────

interface CentroOperativoProps {
  viaje: ViajeResumen;
  onClose: () => void;
  onEstado: (id: string, estado: EstadoProgramacion) => Promise<void>;
  onSync: (id: string) => Promise<void>;
  accionLoading: boolean;
}

export function CentroOperativo({ viaje, onClose, onEstado, onSync, accionLoading }: CentroOperativoProps) {
  const { navigateTo } = useNavigationContext();

  // Observaciones
  const [obs, setObs]             = useState(viaje.observaciones ?? "");
  const [savingObs, setSavingObs] = useState(false);
  const [obsSaved, setObsSaved]   = useState(false);

  // Solicitud vinculada
  const [solicitud, setSolicitud]   = useState<SolicitudVinculadaResult | null>(null);
  const [, setLoadingSol] = useState(false);
  const [, setErrorSol]   = useState<string | null>(null);

  // Modal cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [motivo, setMotivo]                   = useState<MotivoCancelacion | "">("");
  const [comentario, setComentario]           = useState("");
  const [cancelLoading, setCancelLoading]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSol(true);
    setSolicitud(null);
    setErrorSol(null);
    obtenerSolicitudVinculada(viaje.trip_number)
      .then((r)  => { if (!cancelled) setSolicitud(r); })
      .catch((e) => { if (!cancelled) setErrorSol(e instanceof Error ? e.message : "Error"); })
      .finally(()=> { if (!cancelled) setLoadingSol(false); });
    return () => { cancelled = true; };
  }, [viaje.trip_number]);

  const estadoD             = estadoVisual(viaje);
  const esCancelado         = viaje.estado_programacion === "cancelado";
  const esVencido           = estadoD === "vencido";
  const esperandoActivacion = !viaje.activo_en_resume && !esCancelado;

  const tienePhone = !!viaje.conductor_tel;
  const { fecha: fechaProg, hora: horaProg } = splitSchedulate(viaje.schedulate_origin);
  const remision = solicitud && solicitud.vinculada ? solicitud.external_ref ?? undefined : undefined;

  // Estado checklist
  const checks = [
    { label: "Programado",            ok: true },
    { label: "Vehículo asignado",     ok: !!viaje.license_plate },
    { label: "Conductor asignado",    ok: !!viaje.driver_name },
    { label: "Activo en plataforma",  ok: !!viaje.activo_en_resume },
    { label: "Solicitud vinculada",   ok: solicitud?.vinculada === true },
  ];

  const handleGuardarObs = async () => {
    setSavingObs(true);
    setObsSaved(false);
    try {
      await guardarObservacion(viaje.trip_number, obs);
      setObsSaved(true);
      setTimeout(() => setObsSaved(false), 2500);
    } finally {
      setSavingObs(false);
    }
  };

  const handleCancelar = async () => {
    if (!motivo) return;
    setCancelLoading(true);
    try {
      const obsText = motivo === "Otro"
        ? `Cancelado: Otro — ${comentario.trim()}`
        : `Cancelado: ${motivo}`;
      await guardarObservacion(viaje.trip_number, obsText);
      await onEstado(viaje.trip_number, "cancelado");
      setShowCancelModal(false);
    } finally {
      setCancelLoading(false);
    }
  };

  const cancelDisabled = !motivo || (motivo === "Otro" && comentario.trim().length < 5);

  const footer = !esCancelado ? (
    <div className="px-6 py-4 flex flex-col gap-2.5">
      {esperandoActivacion && (
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-center"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          loading={accionLoading}
          onClick={() => onSync(viaje.trip_number)}
        >
          Reintentar sincronización
        </Button>
      )}
      <Button
        variant="ghost"
        size="lg"
        className="w-full justify-center"
        loading={accionLoading}
        onClick={() => {
          setMotivo("");
          setComentario("");
          setShowCancelModal(true);
        }}
        style={{ color: "var(--inlop-red)" }}
      >
        Cancelar programación
      </Button>
    </div>
  ) : null;

  return (
    <>
      <SidePanel
        open
        onClose={onClose}
        title={viaje.trip_number}
        subtitle={viaje.nombre_cliente ?? undefined}
        headerRight={<EstadoBadge estado={estadoD} />}
        footer={footer}
        width="480px"
      >
        {/* Alerta vencido */}
        {esVencido && (
          <div
            className="mx-5 mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl text-[12px] font-medium"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <span>
              La hora programada ya transcurrió y el viaje no se ha activado en la plataforma de seguimiento.
              Verifica el estado con el conductor y usa "Reintentar sincronización" si ya inició.
            </span>
          </div>
        )}

        {/* 1. Resumen */}
        <PanelSection title="Resumen" icon={<FileText className="w-3.5 h-3.5" />} first>
          <InfoRow label="Trip number" value={viaje.trip_number} mono />
          <InfoRow label="Cliente"     value={viaje.nombre_cliente} />
          <InfoRow
            label="Programado"
            value={
              horaProg
                ? <span>{fechaProg} <strong style={{ color: "var(--navy)" }}>{horaProg}</strong></span>
                : fechaProg
            }
          />
          {remision && <InfoRow label="Remisión" value={remision} mono />}
        </PanelSection>

        {/* 2. Conductor y vehículo */}
        <PanelSection title="Conductor y vehículo" icon={<User className="w-3.5 h-3.5" />}>
          {/* Conductor */}
          {viaje.driver_name ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2"
              style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
            >
              {/* Avatar */}
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {viaje.driver_name.charAt(0).toUpperCase()}
              </div>

              {/* Nombre + teléfono */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--gray-800)" }}>
                  {viaje.driver_name}
                </div>
                {viaje.conductor_tel ? (
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--gray-500)" }}>
                    {viaje.conductor_tel}
                  </div>
                ) : (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-300)" }}>
                    Sin número registrado
                  </div>
                )}
              </div>

              {/* Contacto */}
              <div className="flex items-center gap-1.5 shrink-0">
                {tienePhone ? (
                  <a
                    href={formatTelUri(viaje.conductor_tel!)}
                    title="Llamar al conductor"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                    style={{ background: "#EFF6FF", color: "var(--navy)" }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span
                    title="No existe un número de contacto registrado para este conductor."
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-not-allowed"
                    style={{ background: "var(--gray-50)", color: "var(--gray-300)", border: "1px solid var(--gray-100)" }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                )}
                {tienePhone ? (
                  <a
                    href={formatWaUri(viaje.conductor_tel!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Enviar mensaje por WhatsApp"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                    style={{ background: "#F0FDF4", color: "#25D366" }}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span
                    title="No existe un número de contacto registrado para este conductor."
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-not-allowed"
                    style={{ background: "var(--gray-50)", color: "var(--gray-300)", border: "1px solid var(--gray-100)" }}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl mb-2"
              style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              Sin conductor asignado
            </div>
          )}

          {/* Vehículo */}
          {viaje.license_plate ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
            >
              <Car className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <div>
                <div className="text-[16px] font-bold tracking-widest font-mono" style={{ color: "var(--navy)" }}>
                  {viaje.license_plate}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                  {viaje.tipo_servicio ?? "—"} · {lineaNegocio(viaje.type_operation)}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
              style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
            >
              <Car className="w-3.5 h-3.5 shrink-0" />
              Sin vehículo asignado
            </div>
          )}
        </PanelSection>

        {/* 3. Ruta */}
        <PanelSection title="Ruta" icon={<MapPin className="w-3.5 h-3.5" />}>
          <div
            className="flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
              <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
            </div>
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
                <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                  {viaje.city_origin ?? "—"}
                </div>
                {viaje.origin_address && (
                  <div className="text-[11px] truncate" style={{ color: "var(--gray-400)" }}>
                    {viaje.origin_address}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
                <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                  {viaje.city_destination ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </PanelSection>

        {/* 4. Estado de la Programación */}
        <PanelSection title="Estado de la programación" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
          <div className="flex flex-col gap-2">
            {checks.map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2.5 text-[13px]">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: ok ? "#ECFDF5" : "var(--gray-100)",
                    color: ok ? "#059669" : "var(--gray-300)",
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <span style={{ color: ok ? "var(--gray-800)" : "var(--gray-400)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </PanelSection>

        {/* 5. Observaciones */}
        <PanelSection title="Observaciones" icon={<FileText className="w-3.5 h-3.5" />}>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Notas internas del operador…"
            rows={3}
            className="w-full text-[13px] resize-none outline-none"
            style={{
              border: "1.5px solid var(--gray-200)",
              borderRadius: 10,
              padding: "10px 12px",
              color: "var(--gray-700)",
              background: "#fff",
              lineHeight: 1.5,
            }}
          />
          <div className="flex items-center justify-between mt-2">
            {obsSaved && (
              <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--success)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Guardado
              </span>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" loading={savingObs} onClick={handleGuardarObs}>
                Guardar nota
              </Button>
            </div>
          </div>
        </PanelSection>

        {/* 6. Conexiones */}
        <PanelSection title="Conexiones" icon={<Link2 className="w-3.5 h-3.5" />}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigateTo(navActions.verViaje(viaje.trip_number, "programacion"))}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
              style={{ background: "#fff", color: "var(--gray-700)", border: "1.5px solid var(--gray-200)", cursor: "pointer" }}
            >
              <span className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5" style={{ color: "var(--navy)" }} />
                Ver en Viajes Activos
              </span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
            </button>

            {viaje.license_plate && (
              <button
                type="button"
                onClick={() => navigateTo(navActions.verGps(viaje.license_plate!, viaje.trip_number, "programacion"))}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
                style={{ background: "#fff", color: "var(--gray-700)", border: "1.5px solid var(--gray-200)", cursor: "pointer" }}
              >
                <span className="flex items-center gap-2">
                  <Map className="w-3.5 h-3.5" style={{ color: "var(--navy)" }} />
                  Ver en Centro GPS
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
              </button>
            )}
          </div>
        </PanelSection>
      </SidePanel>

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCancelModal(false); }}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl overflow-hidden"
            style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
          >
            {/* Cabecera */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--gray-100)" }}
            >
              <div>
                <div className="text-[15px] font-bold" style={{ color: "var(--gray-900)" }}>
                  Cancelar programación
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                  {viaje.trip_number}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--gray-400)" }}
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--gray-600)" }}>
                  Motivo de cancelación
                </div>
                <div className="flex flex-col gap-1.5">
                  {MOTIVOS_CANCELACION.map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-[13px]"
                      style={{
                        border: motivo === m ? "1.5px solid var(--navy)" : "1.5px solid var(--gray-200)",
                        background: motivo === m ? "#EFF6FF" : "#fff",
                        color: motivo === m ? "var(--navy)" : "var(--gray-700)",
                        fontWeight: motivo === m ? 600 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="motivo"
                        value={m}
                        checked={motivo === m}
                        onChange={() => setMotivo(m)}
                        className="sr-only"
                      />
                      <span
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: motivo === m ? "var(--navy)" : "var(--gray-300)" }}
                      >
                        {motivo === m && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "var(--navy)" }}
                          />
                        )}
                      </span>
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {/* Campo comentario — solo "Otro" */}
              {motivo === "Otro" && (
                <div>
                  <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--gray-600)" }}>
                    Descripción <span style={{ color: "var(--inlop-red)" }}>*</span>
                  </div>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Describe el motivo de cancelación…"
                    rows={2}
                    autoFocus
                    className="w-full text-[13px] resize-none outline-none"
                    style={{
                      border: "1.5px solid var(--gray-200)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "var(--gray-700)",
                      background: "#fff",
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2.5 px-5 py-4"
              style={{ borderTop: "1px solid var(--gray-100)" }}
            >
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
              >
                Volver
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={cancelLoading}
                disabled={cancelDisabled}
                onClick={handleCancelar}
                style={{ background: "var(--inlop-red)", borderColor: "var(--inlop-red)" }}
              >
                Confirmar cancelación
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
