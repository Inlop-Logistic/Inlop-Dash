/**
 * Etapa 03 — Columnas
 *
 * Constructor de columnas de dos paneles:
 *   - Izquierda "Datos disponibles" → todos los campos del reporte
 *     seleccionado con seleccionableColumna = true, que aún NO están en el
 *     reporte. Se agregan con el botón "+".
 *   - Derecha "Columnas del reporte" → columnas incluidas, en el orden en
 *     que aparecerán. Se reordenan con drag & drop (o los botones ↑↓ como
 *     alternativa accesible), se renombran con un campo de texto inline, y
 *     se quitan con "×" (vuelven a la izquierda, nunca se borran del dataset).
 *
 * Los datos disponibles salen exclusivamente de CATALOGO_REPORTES — no hay
 * ningún catálogo de columnas propio de esta etapa.
 *
 * Cada columna seleccionada se persiste como { campo, titulo, orden }:
 *   - campo  → clave técnica estable del catálogo (nunca la modifica el usuario)
 *   - titulo → nombre visible, editable, por defecto el label del catálogo
 *   - orden  → posición 0-based, definida por la posición en el panel derecho
 *
 * El componente recibe `key={tipoReporte}` desde ConfiguradorReporte, por lo
 * que se remonta limpio cada vez que cambia el reporte — no necesita useEffect
 * para sincronizar el cambio de reporte.
 *
 * Componente controlado: el estado vive en ConfiguradorReporte.
 */
import { useState }                                              from "react";
import { Columns3, ChevronUp, ChevronDown, GripVertical, Plus, X } from "lucide-react";
import { Button }                                                 from "@/components/ui";
import { buscarReporte }                                          from "@/modules/configuracion/catalogos/datasetsReportes";
import type { CampoDataset }                                      from "@/modules/configuracion/catalogos/datasetsReportes";
import type { ColumnaReporte }                                    from "@/modules/configuracion/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Badge de tipo de dato — solo para orientar al usuario. */
function TipoBadge({ tipo }: { tipo: CampoDataset["tipo"] }) {
  const MAP: Record<CampoDataset["tipo"], { label: string; color: string; bg: string }> = {
    texto:    { label: "Texto",    color: "var(--gray-600)",  bg: "var(--gray-100)"    },
    numero:   { label: "Número",   color: "#1D4ED8",          bg: "#DBEAFE"            },
    fecha:    { label: "Fecha",    color: "#065F46",          bg: "#D1FAE5"            },
    booleano: { label: "Sí / No",  color: "#7C3AED",          bg: "#EDE9FE"            },
    enum:     { label: "Opciones", color: "#92400E",          bg: "#FEF3C7"            },
    // Fase 11A — cliente_normalizado es filtrable, no seleccionableColumna:
    // nunca debería renderizarse aquí, pero el Record debe ser exhaustivo.
    cliente:  { label: "Cliente",  color: "var(--gray-600)",  bg: "var(--gray-100)"    },
  };
  const { label, color, bg } = MAP[tipo] ?? MAP.texto;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold shrink-0"
      style={{ color, background: bg, letterSpacing: "0.01em" }}
    >
      {label}
    </span>
  );
}

const TITULO_INPUT_STYLE: React.CSSProperties = {
  border:       "1.5px solid transparent",
  borderRadius: "6px",
  color:        "var(--gray-800)",
  background:   "transparent",
  outline:      "none",
  width:        "100%",
  fontSize:     "13px",
  fontWeight:   500,
  padding:      "2px 4px",
  marginLeft:   "-4px",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** Columnas incluidas en el reporte, en el orden en que aparecerán. */
  columnas:    ColumnaReporte[];
  tipoReporte: string;
  onChange:    (columnas: ColumnaReporte[]) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EtapaColumnas({ columnas, tipoReporte, onChange }: Props) {
  const camposDisponibles: CampoDataset[] = buscarReporte(tipoReporte)
    ?.campos.filter(c => c.seleccionableColumna) ?? [];

  const campoPorKey = new Map(camposDisponibles.map(c => [c.key, c]));

  /**
   * Estado local de las columnas incluidas. Se inicializa desde `columnas`:
   *   - Si hay entradas válidas para este reporte → úsalas (orden del usuario).
   *   - Si está vacío (primer acceso al paso) → todos los campos disponibles,
   *     en el orden del catálogo, con título = label del catálogo.
   */
  const [seleccionadas, setSeleccionadas] = useState<ColumnaReporte[]>(() => {
    const validas = columnas.filter(c => campoPorKey.has(c.campo));
    if (validas.length > 0) {
      return validas.map((c, i) => ({ ...c, orden: i }));
    }
    return camposDisponibles.map((c, i) => ({ campo: c.key, titulo: c.label, orden: i }));
  });

  const [dragIndex,    setDragIndex]    = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const seleccionadasKeys = new Set(seleccionadas.map(c => c.campo));
  const disponibles = camposDisponibles.filter(c => !seleccionadasKeys.has(c.key));

  // ── Mutaciones con propagación al padre ──────────────────────────────────

  function aplicar(next: ColumnaReporte[]) {
    const normalizado = next.map((c, i) => ({ ...c, orden: i }));
    setSeleccionadas(normalizado);
    onChange(normalizado);
  }

  function agregar(campo: CampoDataset) {
    aplicar([...seleccionadas, { campo: campo.key, titulo: campo.label, orden: seleccionadas.length }]);
  }

  function quitar(campoKey: string) {
    aplicar(seleccionadas.filter(c => c.campo !== campoKey));
  }

  function renombrar(campoKey: string, titulo: string) {
    aplicar(seleccionadas.map(c => (c.campo === campoKey ? { ...c, titulo } : c)));
  }

  /** Si el usuario deja el título vacío, restaura el label del catálogo. */
  function handleBlurTitulo(campoKey: string, tituloActual: string) {
    if (!tituloActual.trim()) {
      renombrar(campoKey, campoPorKey.get(campoKey)?.label ?? campoKey);
    }
  }

  function moverArriba(index: number) {
    if (index === 0) return;
    const next = [...seleccionadas];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    aplicar(next);
  }

  function moverAbajo(index: number) {
    if (index === seleccionadas.length - 1) return;
    const next = [...seleccionadas];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    aplicar(next);
  }

  function restaurarPredeterminadas() {
    aplicar(camposDisponibles.map((c, i) => ({ campo: c.key, titulo: c.label, orden: i })));
  }

  // ── Drag & drop (panel derecho) ───────────────────────────────────────────

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      const next = [...seleccionadas];
      const [movido] = next.splice(dragIndex, 1);
      next.splice(index, 0, movido);
      aplicar(next);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // ── Sin campos disponibles ────────────────────────────────────────────────

  if (camposDisponibles.length === 0) {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: "560px" }}>
        <div>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
            Columnas del reporte
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
            Elige qué columnas aparecerán en el reporte y en qué orden.
          </p>
        </div>
        <div
          className="flex flex-col items-center gap-3 py-10 rounded-xl"
          style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)", color: "var(--gray-400)" }}
        >
          <Columns3 style={{ width: "28px", height: "28px", opacity: 0.45 }} />
          <p className="text-[13px] font-medium">
            Este reporte no tiene columnas configurables
          </p>
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: "820px" }}>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
            Columnas del reporte
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
            Agrega columnas desde los datos disponibles, arrastra para reordenarlas
            y personaliza su nombre visible.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={restaurarPredeterminadas}
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          ↺ Restaurar predeterminadas
        </Button>
      </div>

      {/* ── Dos paneles ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* ── Panel izquierdo: Datos disponibles ── */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-wider mb-1"
            style={{ color: "var(--gray-500)" }}
          >
            Datos disponibles · {disponibles.length}
          </p>

          <div
            className="flex flex-col gap-1.5 overflow-y-auto p-1 -m-1"
            style={{ maxHeight: "420px" }}
          >
            {disponibles.length === 0 ? (
              <div
                className="py-6 px-3 rounded-xl flex items-center justify-center text-center"
                style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
              >
                <p className="text-[12.5px]" style={{ color: "var(--gray-400)" }}>
                  Todos los datos disponibles ya están incluidos en el reporte
                </p>
              </div>
            ) : (
              disponibles.map(campo => (
                <div
                  key={campo.key}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ border: "1.5px solid var(--gray-100)", background: "var(--gray-50)" }}
                >
                  <span
                    className="flex-1 text-[13px] font-medium truncate"
                    style={{ color: "var(--gray-700)" }}
                    title={campo.label}
                  >
                    {campo.label}
                  </span>
                  <TipoBadge tipo={campo.tipo} />
                  <button
                    type="button"
                    aria-label={`Agregar columna ${campo.label}`}
                    onClick={() => agregar(campo)}
                    className="shrink-0 flex items-center justify-center rounded-md transition-colors"
                    style={{
                      width: "24px", height: "24px",
                      border: "1.5px solid var(--navy)",
                      color: "var(--navy)",
                      cursor: "pointer",
                    }}
                  >
                    <Plus style={{ width: "13px", height: "13px" }} strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panel derecho: Columnas del reporte ── */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-wider mb-1"
            style={{ color: "var(--gray-500)" }}
          >
            Columnas del reporte · {seleccionadas.length}
          </p>

          <div
            className="flex flex-col gap-1.5 overflow-y-auto p-1 -m-1"
            style={{ maxHeight: "420px" }}
          >
            {seleccionadas.length === 0 ? (
              <div
                className="py-6 px-3 rounded-xl flex items-center justify-center text-center"
                style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
              >
                <p className="text-[12.5px]" style={{ color: "var(--gray-400)" }}>
                  Ninguna columna seleccionada — agrega desde "Datos disponibles"
                </p>
              </div>
            ) : (
              seleccionadas.map((col, idx) => {
                const campo = campoPorKey.get(col.campo);
                if (!campo) return null;
                const esDragOver = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;
                return (
                  <div
                    key={col.campo}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                    style={{
                      border:     `1.5px solid ${esDragOver ? "var(--navy)" : "var(--gray-200)"}`,
                      background: dragIndex === idx ? "var(--gray-50)" : "#fff",
                      opacity:    dragIndex === idx ? 0.5 : 1,
                    }}
                  >
                    {/* Manija de arrastre */}
                    <span
                      className="shrink-0 flex items-center justify-center"
                      style={{ color: "var(--gray-300)", cursor: "grab" }}
                      aria-hidden="true"
                    >
                      <GripVertical style={{ width: "14px", height: "14px" }} />
                    </span>

                    {/* Posición */}
                    <span
                      className="shrink-0 text-[10.5px] font-semibold tabular-nums"
                      style={{ color: "var(--gray-400)", minWidth: "16px" }}
                    >
                      {idx + 1}
                    </span>

                    {/* Título editable + clave técnica + tipo */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <input
                        type="text"
                        value={col.titulo}
                        onChange={e => renombrar(col.campo, e.target.value)}
                        onFocus={e => { e.currentTarget.style.borderColor = "var(--gray-200)"; }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = "transparent";
                          handleBlurTitulo(col.campo, e.target.value);
                        }}
                        aria-label={`Nombre visible de la columna ${campo.label}`}
                        style={TITULO_INPUT_STYLE}
                      />
                      <span
                        className="text-[10.5px] truncate"
                        style={{ color: "var(--gray-400)", marginLeft: "0px" }}
                        title={campo.key}
                      >
                        {campo.key}
                      </span>
                    </div>

                    <TipoBadge tipo={campo.tipo} />

                    {/* Controles de orden (alternativa accesible al drag & drop) */}
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        aria-label={`Subir ${campo.label}`}
                        onClick={() => moverArriba(idx)}
                        disabled={idx === 0}
                        className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
                        style={{ width: "18px", height: "16px", cursor: idx === 0 ? "default" : "pointer", color: "var(--gray-400)" }}
                      >
                        <ChevronUp style={{ width: "13px", height: "13px" }} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Bajar ${campo.label}`}
                        onClick={() => moverAbajo(idx)}
                        disabled={idx === seleccionadas.length - 1}
                        className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
                        style={{ width: "18px", height: "16px", cursor: idx === seleccionadas.length - 1 ? "default" : "pointer", color: "var(--gray-400)" }}
                      >
                        <ChevronDown style={{ width: "13px", height: "13px" }} />
                      </button>
                    </div>

                    {/* Quitar */}
                    <button
                      type="button"
                      aria-label={`Quitar columna ${campo.label}`}
                      onClick={() => quitar(col.campo)}
                      className="shrink-0 flex items-center justify-center rounded-md transition-colors"
                      style={{ width: "22px", height: "22px", color: "var(--gray-400)", cursor: "pointer" }}
                    >
                      <X style={{ width: "13px", height: "13px" }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Nota */}
      <p className="text-[11.5px]" style={{ color: "var(--gray-400)" }}>
        Las columnas aparecerán en el reporte en el orden mostrado en el panel derecho.
        El nombre visible es solo de presentación — no afecta el campo de origen del dato.
      </p>

    </div>
  );
}
