import { parseFechaTMS } from "@/utils/parseFecha";
import { extraerFechaColombia } from "@/utils/date";
import { lineaNegocio } from "@/utils/lineaNegocio";
import { toTitleCase } from "@/utils/text";
import type { Column } from "@/components/ui";
import type { ViajeResumen } from "../types";
import { EstadoBadge } from "./EstadoBadge";

// ── Paleta de texto unificada (idéntica a Viajes Activos y Finalizados) ──────
const TX  = { color: "var(--gray-700)" } as const;
const DIM = { color: "var(--gray-400)" } as const;

const TZ_COL = "America/Bogota";

// ── Alias de cliente para nombres comercialmente largos ───────────────────────
// El backend resuelve nombre_cliente desde el Maestro de Empresas o del TMS.
// Para nombres aún muy extensos, este mapa define una forma corta de display.
// La clave es el nombre en minúsculas tal como llega del backend.
const CLIENTE_ALIAS: Record<string, string> = {
  "frontera energy colombia corp sucursal colombia": "Frontera Energy",
  "frontera energy colombia corp":                  "Frontera Energy",
};

// ── Helpers de presentación ───────────────────────────────────────────────────

/**
 * Nombre de cliente para la tabla: alias explícito si existe,
 * toTitleCase como fallback general.
 * Tooltip muestra el nombre completo (raw) para trazabilidad.
 */
function clienteDisplay(raw: string | null | undefined): string {
  if (!raw) return "—";
  const clean = raw.trim();
  const alias = CLIENTE_ALIAS[clean.toLowerCase()];
  return alias ?? toTitleCase(clean);
}

/**
 * Nombre corto del responsable INLOP: Primer nombre + primer apellido.
 * Formato colombiano asumido:
 *   2 palabras → "Nombre Apellido" (sin cambio)
 *   3 palabras → "Nombre PrimerApellido" (palabras 0 y 1)
 *   4 palabras → "Nombre PrimerApellido" (palabras 0 y 2, se omite segundo nombre)
 *   5+         → mismo patrón que 4 palabras
 * El nombre completo se muestra en tooltip vía `title`.
 */
function responsableCorto(full: string | null | undefined): string {
  if (!full) return "—";
  const words = full.trim().replace(/\s+/g, " ").split(" ");
  const tc = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  if (words.length <= 2) return words.map(tc).join(" ");
  // 3 palabras: Nombre PrimAp SegAp → "Nombre PrimAp"
  if (words.length === 3) return `${tc(words[0])} ${tc(words[1])}`;
  // 4+ palabras: PrimN SegN PrimAp SegAp → "PrimN PrimAp" (se omite segundo nombre)
  return `${tc(words[0])} ${tc(words[2])}`;
}

/**
 * Fecha DD/MM/YYYY + hora HH:mm del campo schedulate_origin (formato TMS DMY).
 * La hora tiene valor operativo y se conserva siempre.
 */
function splitSchedulate(raw: string | null | undefined): { fecha: string; hora: string } {
  if (!raw) return { fecha: "—", hora: "" };
  const d = parseFechaTMS(raw, "DMY");
  if (!d) return { fecha: "—", hora: "" };
  const [Y, M, D] = extraerFechaColombia(d).split("-");
  const hora = d.toLocaleTimeString("en-US", {
    timeZone: TZ_COL, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return { fecha: `${D}/${M}/${Y}`, hora };
}

/**
 * Celda de texto una línea con ellipsis y tooltip.
 * maxW = col_width − 8 para evitar desborde bajo table-layout:auto.
 */
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

// ── Columnas ──────────────────────────────────────────────────────────────────
// Orden: Fecha · Manifiesto · Placa · Tipo · Operación · Cliente ·
//        Origen · Destino · Conductor · Teléfono · Estado · Responsable INLOP
// Anchos calibrados para 100% de zoom. Fecha conserva dos líneas (fecha + hora).

export const COLUMNS: Column<ViajeResumen>[] = [

  // ── Fecha ─── DD/MM/YYYY + HH:mm (la hora tiene valor operativo) ─────────
  // col: 110px — dos líneas compactas, la hora en mayor prominencia
  {
    key:    "schedulate_origin",
    header: "Fecha",
    width:  "110px",
    render: (v) => {
      const { fecha, hora } = splitSchedulate(v.schedulate_origin);
      return (
        <div className="tabular-nums leading-none">
          <div className="text-[11px]" style={{ color: "var(--gray-500)" }}>{fecha}</div>
          {hora && (
            <div className="text-[13px] font-semibold mt-0.5" style={TX}>{hora}</div>
          )}
        </div>
      );
    },
  },

  // ── Manifiesto ─── MAYÚSCULAS + semibold, col: 100px ─────────────────────
  {
    key:    "trip_number",
    header: "Manifiesto",
    width:  "100px",
    render: (v) => <TxCell value={v.trip_number} mono semibold upper />,
  },

  // ── Placa ─── MAYÚSCULAS + semibold, col: 84px center ────────────────────
  {
    key:    "license_plate",
    header: "Placa",
    width:  "84px",
    align:  "center",
    render: (v) => v.license_plate
      ? <TxCell value={v.license_plate} mono semibold upper />
      : <span style={DIM}>—</span>,
  },

  // ── Tipo Servicio ─── texto plano, col: 88px center ──────────────────────
  {
    key:    "tipo_servicio",
    header: "Tipo",
    width:  "88px",
    align:  "center",
    render: (v) => (
      <span className="text-[12px] leading-none" style={v.tipo_servicio ? TX : DIM}>
        {v.tipo_servicio ?? "—"}
      </span>
    ),
  },

  // ── Operación ─── col: 128px ("Carga Líquida" cabe en una línea) ──────────
  {
    key:    "linea_negocio",
    header: "Operación",
    width:  "128px",
    render: (v) => (
      <span className="text-[12px] leading-none" style={TX}>
        {lineaNegocio(v.type_operation)}
      </span>
    ),
  },

  // ── Cliente ─── alias/toTitleCase + tooltip, col: 164px → maxW 156 ───────
  {
    key:    "cliente",
    header: "Cliente",
    width:  "164px",
    render: (v) => {
      const display = clienteDisplay(v.nombre_cliente);
      const full    = v.nombre_cliente?.trim() ?? undefined;
      return (
        <span
          className="text-[12px] block truncate leading-none"
          style={{ ...(display === "—" ? DIM : TX), maxWidth: 156 }}
          title={display !== "—" && full && full !== display ? full : undefined}
        >
          {display}
        </span>
      );
    },
  },

  // ── Origen ─── toTitleCase + tooltip, col: 104px → maxW 96 ───────────────
  {
    key:    "city_origin",
    header: "Origen",
    width:  "104px",
    render: (v) => (
      <TxCell
        value={toTitleCase(v.city_origin)}
        dim={!v.city_origin}
        maxW={96}
      />
    ),
  },

  // ── Destino ─── toTitleCase + tooltip, col: 104px → maxW 96 ──────────────
  {
    key:    "city_destination",
    header: "Destino",
    width:  "104px",
    render: (v) => (
      <TxCell
        value={toTitleCase(v.city_destination)}
        dim={!v.city_destination}
        maxW={96}
      />
    ),
  },

  // ── Conductor ─── toTitleCase + tooltip, col: 140px → maxW 132 ───────────
  {
    key:    "driver_name",
    header: "Conductor",
    width:  "140px",
    render: (v) => (
      <TxCell
        value={v.driver_name ? toTitleCase(v.driver_name) : "—"}
        dim={!v.driver_name}
        maxW={132}
      />
    ),
  },

  // ── Teléfono ─── col: 104px ───────────────────────────────────────────────
  {
    key:    "conductor_tel",
    header: "Teléfono",
    width:  "104px",
    render: (v) => (
      <span
        className="text-[12px] font-mono leading-none"
        style={v.conductor_tel ? TX : DIM}
      >
        {v.conductor_tel ?? "—"}
      </span>
    ),
  },

  // ── Estado ─── badge semántico, col: 136px ────────────────────────────────
  {
    key:    "estado",
    header: "Estado",
    width:  "136px",
    render: (v) => <EstadoBadge estado={v.estado_programacion} />,
  },

  // ── Responsable INLOP ─── Nombre + primer apellido, tooltip completo ──────
  // col: 140px → maxW 132
  {
    key:    "planificado_por_nombre",
    header: "Responsable INLOP",
    width:  "140px",
    render: (v) => {
      const corto = responsableCorto(v.planificado_por_nombre);
      return (
        <TxCell
          value={corto}
          dim={!v.planificado_por_nombre}
          maxW={132}
        />
      );
    },
  },
];
