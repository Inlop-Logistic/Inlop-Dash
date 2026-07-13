interface TimelineItemProps {
  icon:         React.ReactNode;
  label:        string;
  sublabel?:    string | null;
  timestamp?:   string | null;
  status:       "completed" | "active" | "pending" | "cancelled";
  isLast?:      boolean;
}

const STATUS_COLOR: Record<TimelineItemProps["status"], string> = {
  completed: "#059669",
  active:    "var(--navy)",
  pending:   "var(--gray-300)",
  cancelled: "#DC2626",
};

const STATUS_BG: Record<TimelineItemProps["status"], string> = {
  completed: "#D1FAE5",
  active:    "#DBEAFE",
  pending:   "var(--gray-100)",
  cancelled: "#FEE2E2",
};

export function TimelineItem({ icon, label, sublabel, timestamp, status, isLast }: TimelineItemProps) {
  const color = STATUS_COLOR[status];
  const bg    = STATUS_BG[status];
  const dim   = status === "pending";

  return (
    <div className="flex gap-3">
      {/* Eje vertical */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: bg, color, border: `2px solid ${color}`, opacity: dim ? 0.4 : 1 }}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1" style={{ background: dim ? "var(--gray-100)" : "var(--gray-200)", minHeight: 20 }} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[13px] font-semibold leading-tight"
            style={{ color: dim ? "var(--gray-300)" : "var(--gray-800)" }}
          >
            {label}
          </span>
          {timestamp && (
            <span className="text-[11px] font-mono shrink-0" style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}>
              {timestamp}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: dim ? "var(--gray-200)" : "var(--gray-400)" }}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
