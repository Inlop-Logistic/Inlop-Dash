import { useEffect, useState } from "react";
import {
  ClipboardList, CalendarClock, Truck, CheckCircle2, FileCheck,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import { fmtTms } from "@/utils/parseFecha";
import type { CumplidoRecord, SoporteCumplido } from "../types";
import { listarSoportesCumplido } from "../services/api";
import { obtenerSolicitudVinculada } from "@/modules/programacion/services/api";
import type { SolicitudVinculadaResult } from "@/modules/programacion/types";

type ItemStatus = "completed" | "active" | "pending";

const STATUS_COLOR: Record<ItemStatus, string> = {
  completed: "#059669",
  active:    "var(--navy)",
  pending:   "var(--gray-300)",
};
const STATUS_BG: Record<ItemStatus, string> = {
  completed: "#D1FAE5",
  active:    "#DBEAFE",
  pending:   "var(--gray-100)",
};

// Opciones de formato compartidas — fecha corta + hora, siempre con año.
const OPTS_FECHA_HORA: Intl.DateTimeFormatOptions = {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
};

/** Formatea un timestamp ISO (Supabase timestamptz) en hora Colombia. */
function fmtIso(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", ...OPTS_FECHA_HORA });
}

interface TLItemProps {
  icon:      React.ReactNode;
  label:     string;
  sublabel?: string;
  timestamp?: string | null;
  status:    ItemStatus;
  isLast?:   boolean;
}

function TLItem({ icon, label, sublabel, timestamp, status, isLast }: TLItemProps) {
  const color = STATUS_COLOR[status];
  const bg    = STATUS_BG[status];
  const dim   = status === "pending";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: bg, color, border: `2px solid ${color}`, opacity: dim ? 0.35 : 1 }}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{ background: dim ? "var(--gray-100)" : "var(--gray-200)", minHeight: 20 }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[13px] font-semibold"
            style={{ color: dim ? "var(--gray-300)" : "var(--gray-800)" }}
          >
            {label}
          </span>
          {timestamp && (
            <span
              className="text-[11px] font-mono shrink-0"
              style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}
            >
              {timestamp}
            </span>
          )}
        </div>
        {sublabel && (
          <p
            className="text-[11px] mt-0.5 leading-snug"
            style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

interface Hito {
  status:    ItemStatus;
  sublabel:  string;
  timestamp: string | null;
}

// ─── Hito 1: Solicitud creada ───────────────────────────────────────────────
// Fuente real: tabla `solicitudes` (creado_en), vinculada por controlt_trip_number
// vía GET /api/programacion/:id/solicitud (mismo endpoint que "Abrir Solicitud").
// Sin solicitud vinculada: el viaje existe igualmente (fuente TMS/ControlT directa),
// se marca completado pero sin fecha inventada.
function hitoSolicitud(sol: SolicitudVinculadaResult | null, solCargando: boolean): Hito {
  if (solCargando) {
    return { status: "pending", sublabel: "Consultando solicitud de origen…", timestamp: null };
  }
  if (sol && sol.vinculada) {
    return {
      status:    "completed",
      sublabel:  `Solicitud ${sol.codigo_solicitud} registrada en el sistema`,
      timestamp: fmtIso(sol.creado_en),
    };
  }
  return {
    status:    "completed",
    sublabel:  "Servicio registrado — sin solicitud vinculada en el sistema",
    timestamp: null,
  };
}

// ─── Hito 2: Viaje programado ───────────────────────────────────────────────
// Fuente real: `solicitudes.fecha_confirmacion` (momento en que la solicitud
// pasó a estado 'confirmado', asignando vehículo y conductor). Si el viaje no
// tiene solicitud vinculada, se usa como evidencia directa la presencia de
// placa y conductor en el propio registro de cumplido — sin fecha, porque no
// existe un timestamp real de esa asignación fuera de la solicitud.
function hitoProgramado(
  sol: SolicitudVinculadaResult | null,
  solCargando: boolean,
  cumplido: CumplidoRecord,
): Hito {
  if (solCargando) {
    return { status: "pending", sublabel: "Consultando estado de la solicitud…", timestamp: null };
  }
  if (sol && sol.vinculada) {
    if (sol.fecha_confirmacion) {
      return {
        status:    "completed",
        sublabel:  `Solicitud ${sol.codigo_solicitud} confirmada — vehículo y conductor asignados`,
        timestamp: fmtIso(sol.fecha_confirmacion),
      };
    }
    if (sol.estado === "cancelado") {
      return { status: "pending", sublabel: `Solicitud ${sol.codigo_solicitud} cancelada`, timestamp: null };
    }
    return {
      status:    "active",
      sublabel:  `Solicitud ${sol.codigo_solicitud} pendiente de confirmación`,
      timestamp: null,
    };
  }
  if (cumplido.license_plate && cumplido.driver_name) {
    return {
      status:    "completed",
      sublabel:  "Vehículo y conductor asignados (sin solicitud vinculada)",
      timestamp: null,
    };
  }
  return { status: "pending", sublabel: "Sin vehículo ni conductor asignado", timestamp: null };
}

// ─── Hito 3: Viaje en tránsito ───────────────────────────────────────────────
// Fuente real: `cumplidos.fecha_viaje` (activated_on) — momento real de
// activación del viaje en la plataforma de monitoreo (ControlT/TMS).
function hitoTransito(cumplido: CumplidoRecord): Hito {
  if (!cumplido.activated_on) {
    return { status: "pending", sublabel: "Aún no inicia el viaje", timestamp: null };
  }
  const inicio = fmtTms(cumplido.activated_on, "MDY", OPTS_FECHA_HORA);
  if (!cumplido.fecha_cumplido) {
    return { status: "active", sublabel: "Viaje actualmente en tránsito", timestamp: inicio };
  }
  return { status: "completed", sublabel: "Servicio activo en plataforma de monitoreo", timestamp: inicio };
}

// ─── Hito 4: Viaje finalizado ───────────────────────────────────────────────
// Fuente real: `cumplidos.fecha_finalizacion` (fecha_cumplido) — set por
// syncCumplidos al detectar el cierre real del viaje.
function hitoFinalizado(cumplido: CumplidoRecord): Hito {
  if (!cumplido.fecha_cumplido) {
    return { status: "pending", sublabel: "Viaje aún no finalizado", timestamp: null };
  }
  return {
    status:    "completed",
    sublabel:  "Servicio completado en la plataforma",
    timestamp: fmtTms(cumplido.fecha_cumplido, "DMY", OPTS_FECHA_HORA),
  };
}

// ─── Hito 5: Documentación de cumplido ──────────────────────────────────────
// Fuente real: tabla `cumplidos_documentos` (mismos registros que consume
// SoportesCumplido). 0 documentos → pendiente. 1+ → completado, usando la
// fecha del primer soporte cargado (creado_en mínimo del conjunto).
function hitoDocumentacion(soportes: SoporteCumplido[], docsCargando: boolean): Hito {
  if (docsCargando) {
    return { status: "pending", sublabel: "Consultando documentación…", timestamp: null };
  }
  if (soportes.length === 0) {
    return { status: "pending", sublabel: "Sin documentación recibida aún", timestamp: null };
  }
  const tiempos = soportes
    .map((s) => new Date(s.creado_en).getTime())
    .filter((t) => !isNaN(t));
  const primerSoporte = tiempos.length > 0 ? new Date(Math.min(...tiempos)).toISOString() : null;
  const n = soportes.length;
  return {
    status:    "completed",
    sublabel:  `${n} soporte${n !== 1 ? "s" : ""} recibido${n !== 1 ? "s" : ""}`,
    timestamp: fmtIso(primerSoporte),
  };
}

export function TimelineViaje({ cumplido }: { cumplido: CumplidoRecord }) {
  const trip = cumplido.trip_number;

  const [sol, setSol]                 = useState<SolicitudVinculadaResult | null>(null);
  const [solCargando, setSolCargando] = useState(true);

  const [soportes, setSoportes]         = useState<SoporteCumplido[]>([]);
  const [docsCargando, setDocsCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setSolCargando(true);
    obtenerSolicitudVinculada(trip)
      .then((r) => { if (!cancelado) setSol(r); })
      .catch(() => { if (!cancelado) setSol(null); })
      .finally(() => { if (!cancelado) setSolCargando(false); });
    return () => { cancelado = true; };
  }, [trip]);

  useEffect(() => {
    let cancelado = false;
    setDocsCargando(true);
    listarSoportesCumplido(trip)
      .then((r) => { if (!cancelado) setSoportes(r.documentos); })
      .catch(() => { if (!cancelado) setSoportes([]); })
      .finally(() => { if (!cancelado) setDocsCargando(false); });
    return () => { cancelado = true; };
  }, [trip]);

  const h1 = hitoSolicitud(sol, solCargando);
  const h2 = hitoProgramado(sol, solCargando, cumplido);
  const h3 = hitoTransito(cumplido);
  const h4 = hitoFinalizado(cumplido);
  const h5 = hitoDocumentacion(soportes, docsCargando);

  return (
    <PanelSection title="Timeline del viaje" icon={<ClipboardList className="w-3.5 h-3.5" />}>
      <div className="pt-1">
        <TLItem
          icon={<ClipboardList className="w-3 h-3" />}
          label="Solicitud creada"
          sublabel={h1.sublabel}
          timestamp={h1.timestamp}
          status={h1.status}
        />
        <TLItem
          icon={<CalendarClock className="w-3 h-3" />}
          label="Viaje programado"
          sublabel={h2.sublabel}
          timestamp={h2.timestamp}
          status={h2.status}
        />
        <TLItem
          icon={<Truck className="w-3 h-3" />}
          label="Viaje en tránsito"
          sublabel={h3.sublabel}
          timestamp={h3.timestamp}
          status={h3.status}
        />
        <TLItem
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="Viaje finalizado"
          sublabel={h4.sublabel}
          timestamp={h4.timestamp}
          status={h4.status}
        />
        <TLItem
          icon={<FileCheck className="w-3 h-3" />}
          label="Documentación de cumplido"
          sublabel={h5.sublabel}
          timestamp={h5.timestamp}
          status={h5.status}
          isLast
        />
      </div>
    </PanelSection>
  );
}
