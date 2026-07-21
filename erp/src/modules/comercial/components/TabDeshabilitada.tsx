import { Lock } from "lucide-react";

interface TabDeshabilitadaProps {
  tab: string;
}

export function TabDeshabilitada({ tab }: TabDeshabilitadaProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 gap-3"
      style={{ color: "var(--gray-300)" }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--gray-100)" }}
      >
        <Lock className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
      </div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--gray-400)" }}>
        {tab}
      </div>
      <div
        className="text-center max-w-xs"
        style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)", lineHeight: 1.5 }}
      >
        Disponible después de guardar el cliente por primera vez.
      </div>
    </div>
  );
}
