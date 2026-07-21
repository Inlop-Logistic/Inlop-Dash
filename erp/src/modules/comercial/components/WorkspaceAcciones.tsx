import { Edit2, RefreshCw, ClipboardPlus, UserPlus, DollarSign, UploadCloud } from "lucide-react";

interface WorkspaceAccionesProps {
  onEditar:          () => void;
  onCambiarEstado:   () => void;
  onNuevaSolicitud:  () => void;
  onNuevoContacto:   () => void;
  onNuevaTarifa:     () => void;
  onSubirDocumento:  () => void;
  esNuevo?: boolean;
}

interface AccionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
}

function AccionButton({ icon, label, onClick, disabled = false, variant = "default" }: AccionButtonProps) {
  const isDefault = variant === "default";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        fontSize: "var(--text-sm)",
        padding: "6px 12px",
        borderRadius: "var(--radius-lg)",
        border: isDefault ? "1px solid var(--gray-200)" : "none",
        background: isDefault ? "#fff" : "var(--navy)",
        color: isDefault ? "var(--gray-700)" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={e => {
        if (!disabled && isDefault) {
          e.currentTarget.style.borderColor = "var(--gray-300)";
          e.currentTarget.style.background = "var(--gray-50)";
        }
      }}
      onMouseLeave={e => {
        if (!disabled && isDefault) {
          e.currentTarget.style.borderColor = "var(--gray-200)";
          e.currentTarget.style.background = "#fff";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function WorkspaceAcciones({
  onEditar, onCambiarEstado, onNuevaSolicitud, onNuevoContacto, onNuevaTarifa, onSubirDocumento,
  esNuevo = false,
}: WorkspaceAccionesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <AccionButton
        icon={<Edit2 className="w-3.5 h-3.5" />}
        label="Editar"
        onClick={onEditar}
        variant="primary"
      />
      <AccionButton
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        label="Cambiar Estado"
        onClick={onCambiarEstado}
        disabled={esNuevo}
      />
      <AccionButton
        icon={<ClipboardPlus className="w-3.5 h-3.5" />}
        label="Nueva Solicitud"
        onClick={onNuevaSolicitud}
        disabled={esNuevo}
      />
      <AccionButton
        icon={<UserPlus className="w-3.5 h-3.5" />}
        label="Nuevo Contacto"
        onClick={onNuevoContacto}
        disabled={esNuevo}
      />
      <AccionButton
        icon={<DollarSign className="w-3.5 h-3.5" />}
        label="Nueva Tarifa"
        onClick={onNuevaTarifa}
        disabled={esNuevo}
      />
      <AccionButton
        icon={<UploadCloud className="w-3.5 h-3.5" />}
        label="Subir Documento"
        onClick={onSubirDocumento}
        disabled={esNuevo}
      />
    </div>
  );
}
