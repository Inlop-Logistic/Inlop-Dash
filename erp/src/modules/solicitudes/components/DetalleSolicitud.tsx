import { useEffect, useState } from "react";
import {
  User, Truck, MapPin, Calendar, FileText, AlertCircle,
} from "lucide-react";
import { fmtFecha } from "@/utils/date";
import { SidePanel, PanelSection, InfoRow, Button } from "@/components/ui";
import type { Solicitud, SolicitudDetalle as SolicitudDetalleType } from "../types";
import { getSolicitudDetalle } from "../services/api";
import { EstadoBadge } from "./EstadoBadge";
import { CanalBadge } from "./CanalBadge";
import { Timeline } from "./Timeline";

interface DetalleSolicitudProps {
  solicitud: Solicitud;
  onClose:   () => void;
  onEstado:  (id: string, estado: string) => Promise<void>;
}

export function DetalleSolicitud({ solicitud, onClose, onEstado }: DetalleSolicitudProps) {
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

  const d              = detalle;
  const tieneConductor = d?.conductor_nombre;
  const tieneVehiculo  = d?.vehiculo_placa;
  const historial      = d?.historial ?? [];

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

      {/* Identificación */}
      <PanelSection title="Identificación" icon={<FileText className="w-3.5 h-3.5" />} first>
        <InfoRow label="Estado"    value={<EstadoBadge estado={solicitud.estado} />} />
        <InfoRow label="Código"    value={solicitud.codigo_solicitud} mono />
        {solicitud.external_ref && (
          <InfoRow label="Referencia" value={solicitud.external_ref} mono />
        )}
        <div
          className="mt-3 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: "var(--gray-400)" }}
          >
            Llave de correlación operativa
          </div>
          <div className="text-[14px] font-bold font-mono" style={{ color: "var(--navy)" }}>
            {solicitud.external_ref ?? solicitud.codigo_solicitud}
          </div>
          <div className="text-[11px] mt-1 leading-snug" style={{ color: "var(--gray-400)" }}>
            Este identificador permitirá relacionar esta solicitud con la operación logística durante su ciclo de ejecución.
          </div>
        </div>
      </PanelSection>

      {/* Cliente */}
      <PanelSection title="Cliente" icon={<User className="w-3.5 h-3.5" />}>
        <InfoRow label="Cliente"     value={solicitud.cliente} />
        <InfoRow label="Agencia"     value={solicitud.agencia} />
        <InfoRow label="Canal"       value={<CanalBadge canal={solicitud.canal} />} />
        <InfoRow label="Solicitante" value={solicitud.solicitante ?? "No registrado"} />
      </PanelSection>

      {/* Operación */}
      <PanelSection title="Operación" icon={<MapPin className="w-3.5 h-3.5" />}>
        <InfoRow label="Tipo"            value={solicitud.tipo_operacion === "urbana" ? "Urbana" : "Nacional"} />
        <InfoRow label="Tipo vehículo"   value={solicitud.tipo_vehiculo} />
        <InfoRow label="Fecha requerida" value={fmtFecha(solicitud.fecha_requerida)} />

        <div
          className="flex items-center gap-2 mt-3 px-3 py-3 rounded-xl"
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
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{solicitud.origen}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>{solicitud.destino}</div>
            </div>
          </div>
          {d?.distancia_km && (
            <div className="shrink-0 text-right">
              <div className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>{d.distancia_km}</div>
              <div className="text-[10px]" style={{ color: "var(--gray-400)" }}>km</div>
            </div>
          )}
        </div>

        {d?.fecha_inicio_ruta && <InfoRow label="Inicio ruta" value={fmtFecha(d.fecha_inicio_ruta)} />}
        {d?.fecha_fin_ruta    && <InfoRow label="Fin de ruta" value={fmtFecha(d.fecha_fin_ruta)}    />}
        <InfoRow label="Creada"   value={fmtFecha(solicitud.creado_en)} />
        {d?.actualizado_en    && <InfoRow label="Actualizada" value={fmtFecha(d.actualizado_en)}    />}
      </PanelSection>

      {/* Asignación */}
      <PanelSection title="Asignación" icon={<Truck className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando…</div>
        ) : errorDetalle ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--gray-400)" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            No se pudo obtener información adicional
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
              {tieneConductor ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
                    style={{ background: "var(--navy)", color: "#fff" }}
                  >
                    {d!.conductor_nombre!.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: "var(--gray-800)" }}>{d!.conductor_nombre}</div>
                    {d?.conductor_cedula   && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>CC {d.conductor_cedula}</div>}
                    {d?.conductor_telefono && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>📞 {d.conductor_telefono}</div>}
                    {d?.conductor_licencia && <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>Lic. {d.conductor_licencia}</div>}
                  </div>
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
              {tieneVehiculo ? (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className="text-[18px] font-bold tracking-widest"
                        style={{ color: "var(--navy)", fontFamily: "monospace" }}
                      >
                        {d!.vehiculo_placa}
                      </div>
                      {d?.vehiculo_tipo && (
                        <div className="text-[12px] mt-0.5" style={{ color: "var(--gray-500)" }}>{d.vehiculo_tipo}</div>
                      )}
                    </div>
                    {d?.vehiculo_capacidad && (
                      <div className="text-right">
                        <div className="text-[16px] font-bold" style={{ color: "var(--gray-700)" }}>{d.vehiculo_capacidad}</div>
                        <div className="text-[10px]" style={{ color: "var(--gray-400)" }}>capacidad</div>
                      </div>
                    )}
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

          </div>
        )}
      </PanelSection>

      {/* Observaciones (condicional) */}
      {d?.notas && (
        <PanelSection title="Observaciones" icon={<FileText className="w-3.5 h-3.5" />}>
          <div
            className="text-[12px] px-3 py-2.5 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-600)", border: "1px solid var(--gray-100)" }}
          >
            {d.notas}
          </div>
        </PanelSection>
      )}

      {/* Historial */}
      <PanelSection title="Historial" icon={<Calendar className="w-3.5 h-3.5" />}>
        {loadingDetalle ? (
          <div className="text-[12px] py-2" style={{ color: "var(--gray-300)" }}>Cargando historial…</div>
        ) : (
          <Timeline historial={historial} estadoActual={solicitud.estado} />
        )}
      </PanelSection>

    </SidePanel>
  );
}
