import { Radio, CheckCircle2, Clock, AlertTriangle, ShieldAlert, WifiOff } from "lucide-react";
import { KpiCard } from "@/components/ui";
import type { KpisGps } from "../types";

import type { TabGps } from "../constants";

interface GpsKPIsProps {
  kpis:       KpisGps;
  onTabClick: (tab: TabGps) => void;
}

export function GpsKPIs({ kpis, onTabClick }: GpsKPIsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
      <KpiCard
        label="Total"
        value={kpis.total}
        icon={<Radio className="w-4.5 h-4.5" />}
        color="var(--navy)" bg="#DBEAFE"
        onClick={() => onTabClick("todos")}
      />
      <KpiCard
        label="Activos"
        value={kpis.activos}
        icon={<CheckCircle2 className="w-4.5 h-4.5" />}
        color="#065F46" bg="#D1FAE5"
        onClick={() => onTabClick("activos")}
      />
      <KpiCard
        label="Detenidos"
        value={kpis.detenidos}
        icon={<Clock className="w-4.5 h-4.5" />}
        color="#92400E" bg="#FEF3C7"
        onClick={() => onTabClick("detenidos")}
      />
      <KpiCard
        label="Sin reporte"
        value={kpis.sinReporte}
        icon={<WifiOff className="w-4.5 h-4.5" />}
        color="#7C3AED" bg="#EDE9FE"
        onClick={() => onTabClick("sin_senial")}
      />
      <KpiCard
        label="Con alarmas"
        value={kpis.conAlarmas}
        icon={<AlertTriangle className="w-4.5 h-4.5" />}
        color="#9F1239" bg="#FFE4E6"
        onClick={() => onTabClick("alarmas")}
      />
      <KpiCard
        label="Pánico"
        value={kpis.panico}
        icon={<ShieldAlert className="w-4.5 h-4.5" />}
        color="#5B21B6" bg="#EDE9FE"
        onClick={() => onTabClick("alarmas")}
      />
      <KpiCard
        label="Desconectados"
        value={kpis.desconectados}
        icon={<WifiOff className="w-4.5 h-4.5" />}
        color="var(--gray-500)" bg="var(--gray-100)"
        onClick={() => onTabClick("sin_senial")}
      />
    </div>
  );
}
