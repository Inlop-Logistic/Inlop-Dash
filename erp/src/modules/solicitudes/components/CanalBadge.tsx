interface CanalBadgeProps { canal: string }

export function CanalBadge({ canal }: CanalBadgeProps) {
  const isApp = canal === "APP";
  return (
    <span
      className="inline-flex items-center font-semibold text-[var(--text-xs)] px-2 py-0.5 rounded-[var(--radius-md)] tracking-wide"
      style={{
        background: isApp ? "var(--navy)" : "var(--gray-100)",
        color:      isApp ? "#fff"        : "var(--gray-500)",
      }}
    >
      {canal}
    </span>
  );
}
