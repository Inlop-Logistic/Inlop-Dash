import { ArrowRight, Truck, User, Phone, MessageCircle } from "lucide-react";
import { SidePanel, PanelSection, InfoRow } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { CumplidoRecord } from "../types";
import { EstadoDocumental } from "./EstadoDocumental";
import { SoportesCumplido } from "./SoportesCumplido";
import { TimelineViaje } from "./TimelineViaje";
import { ConexionesCumplido } from "./ConexionesCumplido";

interface DetalleCumplidoProps {
  cumplido: CumplidoRecord;
  onClose:  () => void;
}

// Badge compacto para estado_cumplido de TorreControl
function EstadoCumplidoBadge({ estado }: { estado: string | null }) {
  if (!estado || estado === "PENDIENTE") return null;
  const cfg: Record<string, { bg: string; color: string }> = {
    "SOLICITADO":        { bg: "#DBEAFE", color: "#1D4ED8" },
    "CUMPLIDO RECIBIDO": { bg: "#D1FAE5", color: "#059669" },
    "CUMPLIDO ENVIADO":  { bg: "#EDE9FE", color: "#7C3AED" },
    "LIQUIDADO":         { bg: "#D1FAE5", color: "#065F46" },
  };
  const c = cfg[estado] ?? { bg: "var(--gray-100)", color: "var(--gray-500)" };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      {estado}
    </span>
  );
}

export function DetalleCumplido({ cumplido, onClose }: DetalleCumplidoProps) {
  const clienteNombre = cumplido.company_customer_name?.split(",")[0].trim() ?? "—";

  return (
    <SidePanel
      open
      onClose={onClose}
      title={cumplido.trip_number}
      subtitle={clienteNombre !== "—" ? clienteNombre : undefined}
      headerRight={
        <div className="flex items-center gap-1.5 flex-wrap">
          <EstadoCumplidoBadge estado={cumplido.estado_cumplido} />
          <EstadoDocumental estado={cumplido.estado_documental} />
        </div>
      }
      width="500px"
    >
      {/* Ruta + fechas — resumen ejecutivo */}
      <PanelSection first>
        {/* Ruta visual */}
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-xl mb-3"
          style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
        >
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--navy)" }} />
            <div className="w-0.5 h-5" style={{ background: "var(--gray-200)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--inlop-red)" }} />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Origen</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                {cumplido.origin_city_name ?? "—"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--gray-300)" }} />
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--gray-400)" }}>Destino</div>
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--gray-800)" }}>
                {cumplido.destiny_city_name ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Fechas y remisión */}
        <InfoRow
          label="Remisión"
          value={cumplido.number_order ?? "—"}
          mono
        />
        <InfoRow
          label="Fecha viaje"
          value={fmtTms(cumplido.activated_on, "MDY", {
            weekday: "short", day: "2-digit", month: "short", year: "numeric",
          })}
        />
        <InfoRow
          label="Fecha cumplido"
          value={fmtTms(cumplido.fecha_cumplido, "DMY")}
        />
      </PanelSection>

      {/* Asignación: conductor + vehículo + contacto en una tarjeta compacta */}
      <PanelSection title="Asignación" icon={<User className="w-3.5 h-3.5" />}>
        {!cumplido.driver_name && !cumplido.license_plate ? (

          /* ── Sin datos ─────────────────────────────────────────────────── */
          <div
            className="flex items-center gap-2 text-[12px] py-2 px-3 rounded-xl"
            style={{ background: "var(--gray-50)", color: "var(--gray-400)" }}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            Sin asignación
          </div>

        ) : !cumplido.driver_name && cumplido.license_plate ? (

          /* ── Solo vehículo ─────────────────────────────────────────────── */
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            <Truck className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
            <span
              className="text-[16px] font-bold tracking-widest"
              style={{ color: "var(--navy)", fontFamily: "monospace" }}
            >
              {cumplido.license_plate}
            </span>
          </div>

        ) : (

          /* ── Conductor (con o sin vehículo) ────────────────────────────── */
          <div
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
          >
            {/* Avatar inicial */}
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 mt-0.5"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {cumplido.driver_name!.charAt(0).toUpperCase()}
            </div>

            {/* Datos */}
            <div className="flex-1 min-w-0">

              {/* Nombre */}
              <div
                className="text-[13px] font-bold leading-tight"
                style={{ color: "var(--gray-800)" }}
              >
                {cumplido.driver_name}
              </div>

              {/* Teléfono (izq) · Placa (der) */}
              <div className="flex items-center justify-between gap-2 mt-0.5">
                {cumplido.conductor_tel ? (
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: "var(--gray-400)" }}
                  >
                    {cumplido.conductor_tel}
                  </span>
                ) : <span />}

                {cumplido.license_plate && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Truck className="w-3 h-3" style={{ color: "var(--gray-400)" }} />
                    <span
                      className="text-[12px] font-bold tracking-wider"
                      style={{ color: "var(--navy)", fontFamily: "monospace" }}
                    >
                      {cumplido.license_plate}
                    </span>
                  </div>
                )}
              </div>

              {/* Acciones de contacto */}
              {cumplido.conductor_tel && (
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={`tel:${cumplido.conductor_tel}`}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                    style={{
                      background:     "var(--gray-100)",
                      color:          "var(--gray-600)",
                      textDecoration: "none",
                      cursor:         "pointer",
                    }}
                  >
                    <Phone className="w-3 h-3" />
                    Llamar
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const tel    = cumplido.conductor_tel!.replace(/\D/g, "");
                      const nombre = cumplido.driver_name ?? "conductor";
                      window.open(
                        `https://wa.me/57${tel}?text=${encodeURIComponent(
                          `Hola ${nombre}, te contactamos desde Inlop Logística.`,
                        )}`,
                        "_blank",
                      );
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: "#D1FAE5", color: "#065F46", cursor: "pointer" }}
                  >
                    <MessageCircle className="w-3 h-3" />
                    WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>

        )}
      </PanelSection>

      {/* Soportes de cumplido — sección principal */}
      <SoportesCumplido cumplido={cumplido} />

      {/* Timeline del viaje */}
      <TimelineViaje cumplido={cumplido} />

      {/* Conexiones a otros módulos */}
      <ConexionesCumplido cumplido={cumplido} />
    </SidePanel>
  );
}
