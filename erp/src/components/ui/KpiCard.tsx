import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  color: string;
  bg: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

export function KpiCard({ label, value, icon, color, bg, trend, onClick }: KpiCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      style={{ border: "1px solid var(--gray-100)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      onClick={onClick}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-[24px] leading-none" style={{ color: "var(--gray-800)" }}>
          {value}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--gray-400)" }}>
          {label}
        </div>
        {trend && (
          <div
            className="text-[10px] mt-0.5 font-medium"
            style={{ color: trend.value >= 0 ? "var(--success)" : "var(--inlop-red)" }}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}
