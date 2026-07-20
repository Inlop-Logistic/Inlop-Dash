import type { ClienteWorkspaceTab } from "../types";
import { WORKSPACE_TABS } from "../constants";

interface ClienteTabsProps {
  activeTab: ClienteWorkspaceTab;
  onTabChange: (tab: ClienteWorkspaceTab) => void;
}

export function ClienteTabs({ activeTab, onTabChange }: ClienteTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del cliente"
      className="flex items-end overflow-x-auto"
      style={{ scrollbarWidth: "none", gap: 0 }}
    >
      {WORKSPACE_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className="shrink-0 font-medium whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            style={{
              fontSize: "var(--text-sm)",
              padding: "10px 16px",
              borderBottom: active ? "2px solid var(--navy)" : "2px solid transparent",
              color: active ? "var(--navy)" : "var(--gray-500)",
              background: "transparent",
              fontWeight: active ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
