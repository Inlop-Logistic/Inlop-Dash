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
      // Seguimiento GPS solo existe para Gestión Logística — al cambiar a
      // otro módulo se descarta para no dejar un `true` invisible que el
      // backend rechazaría al guardar (valida modulo_id === "gestion_logistica").
      seguimiento_gps: nuevoModulo === "gestion_logistica" ? datos.seguimiento_gps : false,
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

      {/* Seguimiento GPS — exclusivo de Gestión Logística */}
      {datos.modulo_id === "gestion_logistica" && (
        <div>
          <label
            className="flex items-center gap-2.5 cursor-pointer"
            style={{ fontSize: "13px", color: "var(--gray-700)" }}
          >
            <span
              aria-hidden="true"
              className="shrink-0 flex items-center justify-center rounded"
              style={{
                width: "18px", height: "18px",
                border: `2px solid ${datos.seguimiento_gps ? "var(--navy)" : "var(--gray-300)"}`,
                background: datos.seguimiento_gps ? "var(--navy)" : "transparent",
                color: "#fff",
              }}
            >
              {datos.seguimiento_gps && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <input
              type="checkbox"
              checked={datos.seguimiento_gps}
              onChange={e => set("seguimiento_gps", e.target.checked)}
              className="sr-only"
              aria-label="Incluir seguimiento GPS"
            />
            <span className="font-medium">Incluir seguimiento GPS</span>
          </label>
          <p className="text-[11.5px]" style={{ color: "var(--gray-400)", marginTop: "6px", marginLeft: "26px" }}>
            Cada envío de este reporte incluirá un enlace temporal para que los destinatarios
            externos sigan en vivo, solo de lectura, los vehículos de esa ejecución.
          </p>
        </div>
      )}

    </div>
  );
}
