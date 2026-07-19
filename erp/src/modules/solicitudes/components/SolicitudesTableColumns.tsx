import { ChevronRight } from "lucide-react";
import { fmtFechaCort } from "@/utils/date";
import type { Column } from "@/components/ui";
import type { Solicitud } from "../types";
import { EstadoBadge } from "./EstadoBadge";
import { CanalBadge } from "./CanalBadge";

export const COLUMNS: Column<Solicitud>[] = [
  {
    key: "codigo",
    header: "SOL",
    width: "110px",
    render: (s) => (
      <div className="font-bold text-[13px]" style={{ color: "var(--navy)" }}>
        {s.codigo_solicitud}
      </div>
    ),
  },
  {
    key: "remision",
    header: "Remisión",
    width: "100px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
        {s.external_ref ?? "—"}
      </span>
    ),
  },
  {
    key: "canal",
    header: "Canal",
    width: "70px",
    render: (s) => <CanalBadge canal={s.canal} />,
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (s) => (
      <div>
        <div className="text-[13px] font-medium" style={{ color: "var(--gray-700)" }}>{s.cliente}</div>
        <div className="text-[11px]" style={{ color: "var(--gray-400)" }}>{s.agencia}</div>
      </div>
    ),
  },
  {
    key: "vehiculo",
    header: "Vehículo",
    width: "110px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-600)" }}>{s.tipo_vehiculo}</span>
    ),
  },
  {
    key: "ruta",
    header: "Ruta",
    render: (s) => (
      <div className="text-[12px]" style={{ color: "var(--gray-600)" }}>
        <div className="font-medium">{s.origen}</div>
        <div style={{ color: "var(--gray-400)" }}>→ {s.destino}</div>
      </div>
    ),
  },
  {
    key: "fecha",
    header: "F. requerida",
    width: "120px",
    render: (s) => (
      <span className="text-[12px]" style={{ color: "var(--gray-500)" }}>
        {fmtFechaCort(s.fecha_requerida)}
      </span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "120px",
    render: (s) => <EstadoBadge estado={s.estado} />,
  },
  {
    key: "arrow",
    header: "",
    width: "32px",
    render: () => <ChevronRight className="w-4 h-4" style={{ color: "var(--gray-300)" }} />,
  },
];
