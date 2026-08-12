/**
 * Etapa 01 — Información básica
 *
 * Componente controlado: el estado vive en ConfiguradorReporte.
 * No tiene botones propios; la navegación la gestiona el configurador.
 */
import { MODULOS, TIPOS_REPORTE, FORMATOS, type Modulo, type Formato, type DatosInfoBasica } from "../../types";

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
  fontSize:     "12px",
  fontWeight:   600,
  color:        "var(--gray-600)",
  display:      "block",
  marginBottom: "6px",
};

interface Props {
  datos:    DatosInfoBasica;
  onChange: (datos: DatosInfoBasica) => void;
}

export function EtapaInfoBasica({ datos, onChange }: Props) {
  const tiposDelModulo = TIPOS_REPORTE.filter(t => t.moduloId === datos.modulo_id);

  function set<K extends keyof DatosInfoBasica>(key: K, value: DatosInfoBasica[K]) {
    onChange({ ...datos, [key]: value });
  }

  function handleModuloChange(nuevoModulo: Modulo) {
    const primero = TIPOS_REPORTE.find(t => t.moduloId === nuevoModulo);
    onChange({
      ...datos,
      modulo_id:    nuevoModulo,
      tipo_reporte: primero?.value ?? datos.tipo_reporte,
    });
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">

      {/* Nombre */}
      <div>
        <label style={LABEL_STYLE}>
          Nombre <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <input
          type="text"
          value={datos.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej. Reporte diario de operaciones"
          style={INPUT_STYLE}
          autoFocus
        />
      </div>

      {/* Módulo */}
      <div>
        <label style={LABEL_STYLE}>
          Módulo <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <select
          value={datos.modulo_id}
          onChange={e => handleModuloChange(e.target.value as Modulo)}
          style={INPUT_STYLE}
        >
          {MODULOS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Reporte — filtrado por módulo */}
      <div>
        <label style={LABEL_STYLE}>
          Reporte <span style={{ color: "var(--inlop-red)" }}>*</span>
        </label>
        <select
          value={datos.tipo_reporte}
          onChange={e => set("tipo_reporte", e.target.value)}
          style={INPUT_STYLE}
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
          value={datos.asunto}
          onChange={e => set("asunto", e.target.value)}
          placeholder="Ej. Reporte de Viajes Activos — INLOP"
          style={INPUT_STYLE}
        />
      </div>

      {/* Cuerpo del correo */}
      <div>
        <label style={LABEL_STYLE}>Cuerpo del correo</label>
        <textarea
          value={datos.cuerpo}
          onChange={e => set("cuerpo", e.target.value)}
          placeholder="Mensaje adicional que acompañará el adjunto (opcional)"
          rows={3}
          style={{ ...INPUT_STYLE, resize: "vertical" }}
        />
      </div>

      {/* Formato — radio group */}
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
                name="formato-config"
                value={f.value}
                checked={datos.formato === f.value}
                onChange={() => set("formato", f.value as Formato)}
                style={{ accentColor: "var(--navy)" }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Estado inicial */}
      <div>
        <label style={LABEL_STYLE}>Estado inicial</label>
        <select
          value={datos.activo ? "activo" : "inactivo"}
          onChange={e => set("activo", e.target.value === "activo")}
          style={INPUT_STYLE}
        >
          <option value="activo">Activo al publicar</option>
          <option value="inactivo">Inactivo al publicar</option>
        </select>
      </div>

    </div>
  );
}
