import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--navy)", color: "#fff" }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-bold text-[22px] leading-tight" style={{ color: "var(--navy)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
