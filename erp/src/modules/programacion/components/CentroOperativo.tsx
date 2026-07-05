import { useEffect, useState } from "react";
import {
  User, Car, MapPin, FileText, AlertCircle, Link2, CheckCircle2,
} from "lucide-react";
import { fmtFecha, fmtFechaCort, fmtHora } from "@/utils/date";
import { SidePanel, PanelSection, InfoRow, Button } from "@/components/ui";
import type { ViajeResumen, EstadoProgramacion, SolicitudVinculadaResult } from "../types";
import { guardarObservacion, obtenerSolicitudVinculada } from "../services/api";
import { EstadoBadge } from "./EstadoBadge";

interface CentroOperativoProps {
  viaje: ViajeResumen;
  onClose: () => void;
  onEstado: (id: string, estado: EstadoProgramacion) => Promise<void>;
  accionLoading: boolean;
}

export function CentroOperativo({ viaje, onClose, onEstado, accionLoading }: CentroOperativoProps) {
  const [obs, setObs]             = useState(viaje.observaciones ?? "");
  const [savingObs, setSavingObs] = useState(false);
  const [obsSaved, setObsSaved]   = useState(false);

  const [solicitud, setSolicitud]   = useState<SolicitudVinculadaResult | null>(null);
  const [loadingSol, setLoadingSol] = useState(false);
  const [errorSol, setErrorSol]     = useState<string | null>(null);

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

  const estaActivo = viaje.estado_programacion === "programado" || viaje.estado_programacion === "asignado";

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

  const footer = estaActivo ? (
    <div className="px-6 py-4 flex flex-col gap-2.5">
      <Button
        variant="danger"
        size="lg"
        className="w-full justify-center"
        loading={accionLoading}
        onClick={() => onEstado(viaje.trip_number, "no_show")}
      >
        Marcar No show
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="w-full justify-center"
        loading={accionLoading}
        onClick={() => onEstado(viaje.trip_number, "cancelado")}
      >
        Cancelar viaje
      </Button>
    </div>
  ) : null;

  return (
    <SidePanel
      open
      onClose={onClose}
      title={viaje.trip_number}
      subtitle={viaje.company_customer_name ?? undefined}
      headerRight={<EstadoBadge estado={viaje.estado_programacion} />}
      footer={footer}
      width="480px"
    >
      {/* Identificación */}
      <PanelSection title="Identificación" icon={<FileText className="w-3.5 h-3.5" />} first>
        <InfoRow label="Trip number"      value={viaje.trip_number} mono />
        <InfoRow label="Cliente"          value={viaje.company_customer_name} />
        <InfoRow label="Fecha programada" value={fmtFechaCort(viaje.fecha_programada_dia)} />
        <InfoRow label="Hora salida"      value={fmtHora(viaje.schedulate_origin)} />
        <InfoRow label="Detectado"        value={fmtFecha(viaje.fecha_detectado)} />
      </PanelSection>

      {/* Solicitud Origen */}
      <PanelSection title="Solicitud Origen" icon={<Link2 className="w-3.5 h-3.5" />}>
        {loadingSol ? (
          <div className="py-3 text-center text-[12px]" style={{ color: "var(--gray-400)" }}>
            Consultando solicitud…
          </div>
        ) : errorSol ? (
          <div
            className="flex items-center gap-2 text-[12px] px-3 py-2.5 rounded-xl"
            style={{ background: "var(--danger-bg)", color: "#9F1239" }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Error al consultar: {errorSol}
          </div>
        ) : solicitud === null ? null : !solicitud.vinculada ? (
          <div
            className="flex items-center gap-2 text-[12px] px-3 py-2.5 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)", border: "1px solid var(--gray-100)" }}
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            Viaje sin Solicitud asociada
          </div>
        ) : (
          <>
            <InfoRow label="Código SOL"         value={solicitud.codigo_solicitud} mono />
            <InfoRow label="Referencia externa" value={solicitud.external_ref} />
            <InfoRow label="Canal"              value={solicitud.canal} />
            <InfoRow label="Estado"             value={<EstadoBadge estado={solicitud.estado} />} />
            <InfoRow label="Cliente"            value={solicitud.cliente} />
            <InfoRow label="Agencia"            value={solicitud.agencia} />
            <InfoRow label="Solicitante"        value={solicitud.solicitante} />
            <InfoRow label="Creación"           value={fmtFecha(solicitud.creado_en)} />
            <InfoRow label="Confirmación"       value={fmtFecha(solicitud.fecha_confirmacion)} />
          </>
        )}
      </PanelSection>

      {/* Conductor y vehículo */}
      <PanelSection title="Conductor y vehículo" icon={<User className="w-3.5 h-3.5" />}>
        {viaje.driver_name ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {viaje.driver_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>
                {viaje.driver_name}
              </div>
              {viaje.license_plate && (
                <div className="text-[12px] mt-0.5 font-mono" style={{ color: "var(--gray-500)" }}>
                  {viaje.license_plate}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl mb-3"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            Sin conductor asignado
          </div>
        )}
        {viaje.license_plate && (
          <div
            className="p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <div
                className="text-[18px] font-bold tracking-widest"
                style={{ color: "var(--navy)", fontFamily: "monospace" }}
              >
                {viaje.license_plate}
              </div>
            </div>
          </div>
        )}
      </PanelSection>

      {/* Ruta */}
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

      {/* Observaciones */}
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
    </SidePanel>
  );
}
