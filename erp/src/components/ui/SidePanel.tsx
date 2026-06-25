import type { ReactNode } from "react";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  width = "460px",
}: SidePanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: "rgba(1,42,107,0.25)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="h-full flex flex-col bg-white"
        style={{
          width: "100%",
          maxWidth: width,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          transform: "translateX(0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--gray-100)" }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[16px] leading-tight" style={{ color: "var(--navy)" }}>
              {title}
            </div>
            {subtitle && (
              <div className="text-[12px] mt-0.5" style={{ color: "var(--gray-400)" }}>
                {subtitle}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0" style={{ borderTop: "1px solid var(--gray-100)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper para secciones dentro del panel ─────────────────────────────────

interface PanelSectionProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  first?: boolean;
}

export function PanelSection({ title, icon, children, first = false }: PanelSectionProps) {
  return (
    <div
      className="px-6 py-5"
      style={!first ? { borderTop: "1px solid var(--gray-100)" } : undefined}
    >
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {icon && (
            <span className="text-[14px]" style={{ color: "var(--gray-400)" }}>{icon}</span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--gray-400)" }}>
            {title}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Fila label / valor ─────────────────────────────────────────────────────

interface InfoRowProps { label: string; value: ReactNode; mono?: boolean }

export function InfoRow({ label, value, mono = false }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[12px] shrink-0" style={{ color: "var(--gray-400)" }}>{label}</span>
      <span
        className={`text-[13px] font-semibold text-right ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--gray-700)" }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
