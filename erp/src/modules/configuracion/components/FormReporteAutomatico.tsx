import { useState } from "react";
import { Button } from "@/components/ui";
import {
  MODULOS, TIPOS_REPORTE, FORMATOS,
  type Modulo, type Formato,
  type ReporteBase, type ReporteAutomatico,
} from "../types";

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
  inicial?:    Partial<ReporteAutomatico>;
  guardando:   boolean;
  labelAccion?: string;
  onGuardar:   (datos: ReporteBase) => Promise<void>;
  onCancelar:  () => void;
}

export function FormReporteAutomatico({
  inicial,
  guardando,
  labelAccion = "Guardar cambios",
  onGuardar,
  onCancelar,
}: Props) {
  const [nombre,      setNombre]      = useState(inicial?.nombre       ?? "");
  const [moduloId,    setModuloId]    = useState<Modulo>(
    (inicial?.modulo_id as Modulo | undefined) ?? MODULOS[0].value
  );
  const [tipoReporte, setTipoReporte] = useState(
    inicial?.tipo_reporte ??
    TIPOS_REPORTE.find(t => t.moduloId === (inicial?.modulo_id ?? MODULOS[0].value))?.value ??
    TIPOS_REPORTE[0].value
  );
  const [asunto,      setAsunto]      = useState(inicial?.asunto       ?? "");
  const [cuerpo,      setCuerpo]      = useState(inicial?.cuerpo       ?? "");
  const [formato,     setFormato]     = useState<Formato>(
    (inicial?.formato as Formato | undefined) ?? "excel"
  );
  const [activo,      setActivo]      = useState(inicial?.activo ?? true);
  const [errorLocal,  setErrorLocal]  = useState<string | null>(null);

  // Reportes disponibles para el módulo seleccionado
  const tiposDelModulo = TIPOS_REPORTE.filter(t => t.moduloId === moduloId);

  function handleModuloChange(nuevoModulo: Modulo) {
    setModuloId(nuevoModulo);
    // Si el tipo actual no pertenece al nuevo módulo, resetear al primero disponible
    const primeroDelModulo = TIPOS_REPORTE.find(t => t.moduloId === nuevoModulo);
    if (primeroDelModulo) setTipoReporte(primeroDelModulo.value);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    if (!nombre.trim()) {
      setErrorLocal("El nombre es obligatorio");
      return;
    }
    if (!asunto.trim()) {
      setErrorLocal("El asunto del correo es obligatorio");
      return;
    }
    try {
      await onGuardar({
        nombre:       nombre.trim(),
        modulo_id:    moduloId,
        tipo_reporte: tipoReporte,
        asunto:       asunto.trim(),
        cuerpo:       cuerpo.trim() || null,
        formato,
        activo,
        frecuencia:   inicial?.frecuencia ?? "diaria",
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

      {/* Módulo */}
      <div>
        <label style={LABEL_STYLE}>
          Módulo <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <select
          value={moduloId}
          onChange={e => handleModuloChange(e.target.value as Modulo)}
          style={INPUT_STYLE}
          required
        >
          {MODULOS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Reporte (filtrado por módulo) */}
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
          {tiposDelModulo.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Asunto del correo */}
      <div>
        <label style={LABEL_STYLE}>
          Asunto del correo <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <input
          type="text"
          value={asunto}
          onChange={e => setAsunto(e.target.value)}
          placeholder="Ej. Reporte de Viajes Activos — INLOP"
          style={INPUT_STYLE}
          required
        />
      </div>

      {/* Cuerpo del correo */}
      <div>
        <label style={LABEL_STYLE}>Cuerpo del correo</label>
        <textarea
          value={cuerpo}
          onChange={e => setCuerpo(e.target.value)}
          placeholder="Mensaje adicional que acompañará el adjunto (opcional)"
          rows={3}
          style={{ ...INPUT_STYLE, resize: "vertical" }}
        />
      </div>

      {/* Formato */}
      <div>
        <label style={LABEL_STYLE}>Formato</label>
        <div className="flex flex-col gap-2" style={{ marginTop: "2px" }}>
          {FORMATOS.map(f => (
            <label
              key={f.value}
              className="flex items-center gap-2 cursor-pointer"
              style={{ fontSize: "13px", color: "var(--gray-700)" }}
            >
              <input
                type="radio"
                name="formato"
                value={f.value}
                checked={formato === f.value}
                onChange={() => setFormato(f.value as Formato)}
                style={{ accentColor: "var(--navy)" }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Estado */}
      <div>
        <label style={LABEL_STYLE}>Estado</label>
        <select
          value={activo ? "activo" : "inactivo"}
          onChange={e => setActivo(e.target.value === "activo")}
          style={INPUT_STYLE}
        >
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
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
