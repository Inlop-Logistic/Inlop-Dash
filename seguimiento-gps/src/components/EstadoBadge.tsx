import { ShieldAlert } from "lucide-react";
import { ESTADO_GPS_CFG } from "../constants";
import { tieneGpsActivo } from "../vehiculos";
import type { VehiculoPublico } from "../types";

interface Props {
  vehiculo: VehiculoPublico;
  size?: "sm" | "md";
}

/** Pill de estado — si el vehículo no tiene GPS activo ahora mismo, se
 *  muestra "Sin señal GPS" en vez del estado reportado por el TMS: un
 *  estado operativo desactualizado (ej. "en tránsito" con lat/lon nulos)
 *  sería engañoso si se pinta como si tuviera posición confiable. */
export function EstadoBadge({ vehiculo, size = "md" }: Props) {
  const activo = tieneGpsActivo(vehiculo);
  const cfg = activo ? ESTADO_GPS_CFG[vehiculo.estado] : { label: "Sin señal GPS", color: "#475569", bg: "#F1F5F9", dot: "#94A3B8", mapColor: "#94A3B8" };
  const esAlerta = activo && (vehiculo.estado === "panico" || vehiculo.estado === "con_alarma");

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${size === "sm" ? "text-[11px] px-2 py-0.5" : "text-[12.5px] px-2.5 py-1"}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {esAlerta ? (
        <ShieldAlert className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      ) : (
        <span
          className={`rounded-full shrink-0 relative ${activo ? "pulso-activo" : ""} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`}
          style={{ background: cfg.dot }}
        />
      )}
      {cfg.label}
    </span>
  );
}
