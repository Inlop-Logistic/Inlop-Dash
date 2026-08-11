/**
 * Etapa 03 — Columnas
 *
 * Permite seleccionar y ordenar las columnas que aparecerán en el reporte.
 * Las columnas disponibles se obtienen exclusivamente de CATALOGO_REPORTES
 * (campos con seleccionableColumna = true) — no hay ningún catálogo propio.
 *
 * Comportamiento de estado:
 *   - Columnas seleccionadas (orden definido por el usuario) → sección superior.
 *   - Columnas disponibles no seleccionadas → sección inferior, en orden de catálogo.
 *   - Toggle: mover a/desde la selección activa.
 *   - Reordenar: flechas ↑↓ sobre las columnas seleccionadas.
 *   - Restaurar predeterminadas: toda la selección en el orden del catálogo.
 *
 * El componente recibe `key={tipoReporte}` desde ConfiguradorReporte, por lo
 * que se remonta limpio cada vez que cambia el reporte — no necesita useEffect
 * para sincronizar el cambio de reporte.
 *
 * Componente controlado: el estado vive en ConfiguradorReporte.
 */
import { useState }                         from "react";
import { Columns3, ChevronUp, ChevronDown } from "lucide-react";
import { Button }                           from "@/components/ui";
import { buscarReporte }                    from "@/modules/configuracion/catalogos/datasetsReportes";
import type { CampoDataset }                from "@/modules/configuracion/catalogos/datasetsReportes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Badge de tipo de dato — solo para orientar al usuario. */
function TipoBadge({ tipo }: { tipo: CampoDataset["tipo"] }) {
  const MAP: Record<CampoDataset["tipo"], { label: string; color: string; bg: string }> = {
    texto:    { label: "Texto",    color: "var(--gray-600)",  bg: "var(--gray-100)"    },
    numero:   { label: "Número",   color: "#1D4ED8",          bg: "#DBEAFE"            },
    fecha:    { label: "Fecha",    color: "#065F46",          bg: "#D1FAE5"            },
    booleano: { label: "Sí / No",  color: "#7C3AED",          bg: "#EDE9FE"            },
    enum:     { label: "Opciones", color: "#92400E",          bg: "#FEF3C7"            },
  };
  const { label, color, bg } = MAP[tipo] ?? MAP.texto;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold"
      style={{ color, background: bg, letterSpacing: "0.01em" }}
    >
      {label}
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  /** Ordered array of selected campo.key values; [] = not yet configured. */
  columnas:    string[];
  tipoReporte: string;
  onChange:    (columnas: string[]) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EtapaColumnas({ columnas, tipoReporte, onChange }: Props) {
  const camposDisponibles: CampoDataset[] = buscarReporte(tipoReporte)
    ?.campos.filter(c => c.seleccionableColumna) ?? [];

  const keysDisponibles = camposDisponibles.map(c => c.key);

  /**
   * Estado local de la selección. Se inicializa desde `columnas` prop:
   *   - Si hay claves válidas en `columnas` → úsalas (orden del usuario).
   *   - Si está vacío (primer acceso al paso) → todas seleccionadas por defecto.
   */
  const [seleccionadas, setSeleccionadas] = useState<string[]>(() => {
    const validas = columnas.filter(k => keysDisponibles.includes(k));
    return validas.length > 0 ? validas : [...keysDisponibles];
  });

  const selSet = new Set(seleccionadas);
  const noSeleccionadas = camposDisponibles.filter(c => !selSet.has(c.key));

  // ── Mutaciones con propagación al padre ──────────────────────────────────

  function aplicar(next: string[]) {
    setSeleccionadas(next);
    onChange(next);
  }

  function toggleColumna(key: string) {
    if (selSet.has(key)) {
      // Deseleccionar: quitar de la selección
      aplicar(seleccionadas.filter(k => k !== key));
    } else {
      // Seleccionar: añadir al final
      aplicar([...seleccionadas, key]);
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
    aplicar([...keysDisponibles]);
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
    <div className="flex flex-col gap-5" style={{ maxWidth: "560px" }}>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
            Columnas del reporte
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
            Selecciona las columnas y arrastra para reordenarlas.
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

      {/* ── Sección: Columnas seleccionadas ── */}
      <div className="flex flex-col gap-1">
        <p
          className="text-[11px] font-bold uppercase tracking-wider mb-1"
          style={{ color: "var(--gray-500)" }}
        >
          Incluidas en el reporte · {seleccionadas.length}
        </p>

        {seleccionadas.length === 0 ? (
          <div
            className="py-6 rounded-xl flex items-center justify-center"
            style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
          >
            <p className="text-[13px]" style={{ color: "var(--gray-400)" }}>
              Ninguna columna seleccionada
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {seleccionadas.map((key, idx) => {
              const campo = camposDisponibles.find(c => c.key === key);
              if (!campo) return null;
              return (
                <ColumnaRow
                  key={key}
                  campo={campo}
                  seleccionada={true}
                  puedeSubir={idx > 0}
                  puedeBajar={idx < seleccionadas.length - 1}
                  onToggle={() => toggleColumna(key)}
                  onSubir={() => moverArriba(idx)}
                  onBajar={() => moverAbajo(idx)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sección: Columnas no incluidas ── */}
      {noSeleccionadas.length > 0 && (
        <div className="flex flex-col gap-1">
          <p
            className="text-[11px] font-bold uppercase tracking-wider mb-1"
            style={{ color: "var(--gray-400)" }}
          >
            No incluidas · {noSeleccionadas.length}
          </p>
          <div className="flex flex-col gap-1.5">
            {noSeleccionadas.map(campo => (
              <ColumnaRow
                key={campo.key}
                campo={campo}
                seleccionada={false}
                puedeSubir={false}
                puedeBajar={false}
                onToggle={() => toggleColumna(campo.key)}
                onSubir={() => {}}
                onBajar={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Nota */}
      <p className="text-[11.5px]" style={{ color: "var(--gray-400)" }}>
        Las columnas aparecerán en el reporte en el orden mostrado arriba.
        El botón "Restaurar predeterminadas" incluye todas las columnas disponibles
        en el orden del catálogo.
      </p>

    </div>
  );
}

// ─── Fila de columna ─────────────────────────────────────────────────────────

interface ColumnaRowProps {
  campo:       CampoDataset;
  seleccionada: boolean;
  puedeSubir:  boolean;
  puedeBajar:  boolean;
  onToggle:    () => void;
  onSubir:     () => void;
  onBajar:     () => void;
}

function ColumnaRow({
  campo, seleccionada, puedeSubir, puedeBajar,
  onToggle, onSubir, onBajar,
}: ColumnaRowProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        border:     `1.5px solid ${seleccionada ? "var(--gray-200)" : "var(--gray-100)"}`,
        background: seleccionada ? "#fff" : "var(--gray-50)",
        opacity:    seleccionada ? 1 : 0.75,
      }}
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={seleccionada ? `Quitar columna ${campo.label}` : `Agregar columna ${campo.label}`}
        onClick={onToggle}
        className="shrink-0 flex items-center justify-center rounded transition-colors"
        style={{
          width:      "18px",
          height:     "18px",
          border:     `2px solid ${seleccionada ? "var(--navy)" : "var(--gray-300)"}`,
          background: seleccionada ? "var(--navy)" : "transparent",
          color:      "#fff",
          cursor:     "pointer",
        }}
      >
        {seleccionada && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Label + tipo */}
      <span
        className="flex-1 text-[13px] font-medium"
        style={{ color: seleccionada ? "var(--gray-800)" : "var(--gray-500)" }}
      >
        {campo.label}
      </span>

      <TipoBadge tipo={campo.tipo} />

      {/* Controles de orden (solo en seleccionadas) */}
      {seleccionada && (
        <div className="flex flex-col shrink-0">
          <button
            type="button"
            aria-label={`Subir ${campo.label}`}
            onClick={onSubir}
            disabled={!puedeSubir}
            className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
            style={{
              width: "20px", height: "18px", cursor: puedeSubir ? "pointer" : "default",
              color: "var(--gray-400)",
            }}
          >
            <ChevronUp style={{ width: "14px", height: "14px" }} />
          </button>
          <button
            type="button"
            aria-label={`Bajar ${campo.label}`}
            onClick={onBajar}
            disabled={!puedeBajar}
            className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
            style={{
              width: "20px", height: "18px", cursor: puedeBajar ? "pointer" : "default",
              color: "var(--gray-400)",
            }}
          >
            <ChevronDown style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      )}
    </div>
  );
}
