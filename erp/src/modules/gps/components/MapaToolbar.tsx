import { ZoomIn, ZoomOut, Maximize2, Layers } from "lucide-react";

interface MapaToolbarProps {
  onZoomIn:    () => void;
  onZoomOut:   () => void;
  onFitAll:    () => void;
  onToggleSat: () => void;
  satellite:   boolean;
}

function ToolBtn({
  icon, onClick, title, active = false,
}: { icon: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
      style={{
        background: active ? "var(--navy)" : "#fff",
        color:      active ? "#fff"        : "var(--gray-600)",
        border:     "1px solid var(--gray-200)",
        boxShadow:  "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {icon}
    </button>
  );
}

export function MapaToolbar({ onZoomIn, onZoomOut, onFitAll, onToggleSat, satellite }: MapaToolbarProps) {
  return (
    <div className="flex flex-col gap-1">
      <ToolBtn icon={<ZoomIn  className="w-4 h-4" />} onClick={onZoomIn}    title="Acercar" />
      <ToolBtn icon={<ZoomOut className="w-4 h-4" />} onClick={onZoomOut}   title="Alejar" />
      <div style={{ height: 1, background: "var(--gray-200)", margin: "2px 0" }} />
      <ToolBtn icon={<Maximize2 className="w-4 h-4" />} onClick={onFitAll}  title="Ver todos" />
      <ToolBtn icon={<Layers   className="w-4 h-4" />} onClick={onToggleSat} title="Satélite" active={satellite} />
    </div>
  );
}
