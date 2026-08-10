import { ChevronRight } from "lucide-react";
import { parseFechaTMS } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { lineaNegocio } from "@/utils/lineaNegocio";
import { toTitleCase } from "@/utils/text";
import { StatusChip } from "@/components/ui";
import type { Column } from "@/components/ui";
import type { CumplidoRecord } from "../types";
import { estadoViajeVisual, ESTADO_VIAJE_CFG } from "../constants";

// ── Paleta de texto unificada (idéntica a Viajes Activos) ────────────────────
const TX  = { color: "var(--gray-700)" } as const;
const DIM = { color: "var(--gray-400)" } as const;

// ── Helper de fecha ──────────────────────────────────────────────────────────
/** Extrae solo DD/MM/AA (sin hora) de un string MM/DD/YYYY HH:MM:SS del TMS. */
function fmtFecha(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = parseFechaTMS(raw, "MDY");
  if (!d) return null;
  const [Y, M, D] = extraerFechaColombia(d).split("-");
  return `${D}/${M}/${Y.slice(2)}`;
}

// ── Celda de texto — idéntica a TxCell de ViajesTableColumns ────────────────
// maxW = col_width - 8 para contener la elipsis correctamente en auto layout.
function TxCell({
  value, dim = false, maxW, mono = false, semibold = false, upper = false,
}: {
  value: string; dim?: boolean; maxW?: number;
  mono?: boolean; semibold?: boolean; upper?: boolean;
}) {
  const display = upper ? value.toUpperCase() : value;
  const isDash  = value === "—";
  return (
    <span
      className={[
        "text-[12px] block truncate leading-none",
        mono     ? "font-mono tabular-nums" : "",
        semibold ? "font-semibold" : "",
      ].join(" ")}
      style={{ ...(dim || isDash ? DIM : TX), maxWidth: maxW }}
      title={!isDash ? display : undefined}
    >
      {display}
    </span>
  );
}

// ── Columnas ─────────────────────────────────────────────────────────────────
// Orden: Fecha · Manifiesto · Placa · Tipo Servicio · Línea Negocio ·
//        Cliente · Origen · Destino · Conductor · Teléfono · Estado · →
// Anchos calibrados para 100% de zoom, coherentes con Viajes Activos.

export const COLUMNS: Column<CumplidoRecord>[] = [

  // ── Fecha ─── solo DD/MM/AA, col: 80px center ────────────────────────────
  {
    key:    "activated_on",
    header: "Fecha Viaje",
    width:  "80px",
    align:  "center",
    render: (c) => {
      const fecha = fmtFecha(c.activated_on);
      return fecha
        ? <span className="text-[12px] font-mono tabular-nums leading-none" style={TX}>{fecha}</span>
        : <span style={DIM}>—</span>;
    },
  },

  // ── Manifiesto ─── MAYÚSCULAS + semibold, col: 100px ─────────────────────
  {
    key:    "trip_number",
    header: "Manifiesto",
    width:  "100px",
    render: (c) => <TxCell value={c.trip_number} mono semibold upper />,
  },

  // ── Placa ─── MAYÚSCULAS + semibold, col: 84px center ────────────────────
  {
    key:    "license_plate",
    header: "Placa",
    width:  "84px",
    align:  "center",
    render: (c) => c.license_plate
      ? <TxCell value={c.license_plate} mono semibold upper />
      : <span style={DIM}>—</span>,
  },

  // ── Tipo Servicio ─── texto plano, col: 88px center ──────────────────────
  {
    key:    "tipo_servicio",
    header: "Tipo",
    width:  "88px",
    align:  "center",
    render: (c) => {
      const o = (c.origin_city_name  ?? "").trim().toLowerCase();
      const d = (c.destiny_city_name ?? "").trim().toLowerCase();
      const tipo = o && d && o === d ? "Urbano" : (o || d) ? "Nacional" : null;
      return (
        <span className="text-[12px] leading-none" style={tipo ? TX : DIM}>
          {tipo ?? "—"}
        </span>
      );
    },
  },

  // ── Línea Negocio ─── col: 128px ─────────────────────────────────────────
  // "Carga Líquida" debe caber en una línea (≥ 123px disponibles)
  {
    key:    "linea_negocio",
    header: "Operación",
    width:  "128px",
    render: (c) => (
      <span className="text-[12px] leading-none" style={TX}>
        {lineaNegocio(c.type_operation)}
      </span>
    ),
  },

  // ── Cliente ─── toTitleCase + tooltip, col: 164px → maxW 156 ─────────────
  {
    key:    "company_customer_name",
    header: "Cliente",
    width:  "164px",
    render: (c) => {
      const raw = c.company_customer_name?.split(",")[0].trim() ?? null;
      return <TxCell value={toTitleCase(raw)} maxW={156} />;
    },
  },

  // ── Origen ─── toTitleCase + tooltip, col: 104px → maxW 96 ───────────────
  {
    key:    "origin_city_name",
    header: "Origen",
    width:  "104px",
    render: (c) => (
      <TxCell
        value={toTitleCase(c.origin_city_name)}
        dim={!c.origin_city_name}
        maxW={96}
      />
    ),
  },

  // ── Destino ─── toTitleCase + tooltip, col: 104px → maxW 96 ──────────────
  {
    key:    "destiny_city_name",
    header: "Destino",
    width:  "104px",
    render: (c) => (
      <TxCell
        value={toTitleCase(c.destiny_city_name)}
        dim={!c.destiny_city_name}
        maxW={96}
      />
    ),
  },

  // ── Conductor ─── toTitleCase + tooltip, col: 140px → maxW 132 ───────────
  {
    key:    "driver_name",
    header: "Conductor",
    width:  "140px",
    render: (c) => (
      <TxCell
        value={c.driver_name ? toTitleCase(c.driver_name) : "—"}
        dim={!c.driver_name}
        maxW={132}
      />
    ),
  },

  // ── Teléfono ─── col: 104px ───────────────────────────────────────────────
  {
    key:    "conductor_tel",
    header: "Teléfono",
    width:  "104px",
    render: (c) => (
      <span
        className="text-[12px] font-mono leading-none"
        style={c.conductor_tel ? TX : DIM}
      >
        {c.conductor_tel ?? "—"}
      </span>
    ),
  },

  // ── Estado ─── badge semántico via StatusChip, col: 136px ────────────────
  {
    key:    "estado_viaje",
    header: "Estado",
    width:  "136px",
    render: (c) => {
      const key = estadoViajeVisual(c);
      const cfg = ESTADO_VIAJE_CFG[key];
      return <StatusChip label={cfg.label} color={cfg.color} bg={cfg.bg} dot={cfg.dot} />;
    },
  },

  // ── Flecha del drawer ─────────────────────────────────────────────────────
  {
    key:    "_actions",
    header: "",
    width:  "36px",
    align:  "center",
    render: () => (
      <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />
    ),
  },
];
