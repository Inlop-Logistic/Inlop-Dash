interface CanalBadgeProps { canal: string }

const CANALES: Record<string, { label: string; background: string; color: string }> = {
  APP: { label: "APP", background: "var(--navy)", color: "#fff" },
  CRM: { label: "CRM", background: "var(--orange-500, #f97316)", color: "#fff" },
};

export function CanalBadge({ canal }: CanalBadgeProps) {
  const config = CANALES[canal] ?? {
    label: canal || "—",
    background: "var(--gray-100)",
    color: "var(--gray-600)",
  };

  return (
    <span
      className="inline-flex items-center font-semibold text-[var(--text-xs)] px-2 py-0.5 rounded-[var(--radius-md)] tracking-wide"
      style={{ background: config.background, color: config.color }}
      title={canal === "CRM" ? "Canal interno de solicitudes" : canal === "APP" ? "Portal de clientes" : undefined}
    >
      {config.label}
    </span>
  );
}
