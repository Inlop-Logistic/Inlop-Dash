import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "outline";
type Size    = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "text-white hover:opacity-90",
  ghost:   "hover:bg-[var(--gray-100)]",
  danger:  "hover:bg-[var(--danger-bg)]",
  outline: "bg-white hover:bg-[var(--gray-50)]",
};

const VARIANT_INLINE: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--navy)" },
  ghost:   { color: "var(--gray-600)" },
  danger:  { border: "1.5px solid var(--danger-light)", color: "var(--inlop-red)" },
  outline: { border: "1.5px solid var(--gray-200)", color: "var(--gray-700)" },
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "text-[var(--text-base)] px-3 py-1.5 rounded-[var(--radius-lg)]",
  md: "text-[var(--text-md)] px-4 py-2.5 rounded-[var(--radius-xl)]",
  lg: "text-[var(--text-lg)] px-5 py-3 rounded-[var(--radius-xl)]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      style={{ ...VARIANT_INLINE[variant], ...style }}
      {...rest}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
