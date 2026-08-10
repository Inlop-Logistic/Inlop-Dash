import { useState } from "react";
import { Button } from "@/components/ui";
import { TIPOS_REPORTE, FRECUENCIAS, type Frecuencia, type ReporteBase, type ReporteAutomatico } from "../types";

const INPUT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: "var(--radius-lg)",
  color:        "var(--gray-700)",
  background:   "#fff",
  outline:      "none",
  width:        "100%",
  fontSize:     "13px",
  padding:      "10px 12px",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:   "12px",
  fontWeight: 600,
  color:      "var(--gray-600)",
  display:    "block",
  marginBottom: "6px",
};

interface Props {
  /** Reporte inicial (edición) — undefined para crear desde cero */
  inicial?:   Partial<ReporteAutomatico>;
  guardando:  boolean;
  labelAccion?: string;
  onGuardar:  (datos: ReporteBase) => Promise<void>;
  onCancelar: () => void;
}

export function FormReporteAutomatico({
  inicial,
  guardando,
  labelAccion = "Guardar cambios",
  onGuardar,
  onCancelar,
}: Props) {
  const [nombre,      setNombre]      = useState(inicial?.nombre       ?? "");
  const [tipoReporte, setTipoReporte] = useState(inicial?.tipo_reporte ?? TIPOS_REPORTE[0].value);
  const [frecuencia,  setFrecuencia]  = useState<Frecuencia>(inicial?.frecuencia ?? "diaria");
  const [errorLocal,  setErrorLocal]  = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    if (!nombre.trim()) {
      setErrorLocal("El nombre es obligatorio");
      return;
    }
    try {
      await onGuardar({
        nombre:       nombre.trim(),
        tipo_reporte: tipoReporte,
        frecuencia:   frecuencia as ReporteBase["frecuencia"],
      });
    } catch (e) {
      setErrorLocal(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Nombre */}
      <div>
        <label style={LABEL_STYLE}>
          Nombre <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Reporte diario de operaciones"
          style={INPUT_STYLE}
          autoFocus
          required
        />
      </div>

      {/* Tipo de reporte */}
      <div>
        <label style={LABEL_STYLE}>
          Reporte <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <select
          value={tipoReporte}
          onChange={e => setTipoReporte(e.target.value)}
          style={INPUT_STYLE}
          required
        >
          {TIPOS_REPORTE.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Frecuencia */}
      <div>
        <label style={LABEL_STYLE}>
          Frecuencia <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <select
          value={frecuencia}
          onChange={e => {
            const match = FRECUENCIAS.find(f => f.value === e.target.value);
            if (match) setFrecuencia(match.value);
          }}
          style={INPUT_STYLE}
          required
        >
          {FRECUENCIAS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {errorLocal && (
        <p className="text-[12px]" style={{ color: "var(--inlop-red)" }}>
          {errorLocal}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={guardando}>
          {labelAccion}
        </Button>
      </div>
    </form>
  );
}
