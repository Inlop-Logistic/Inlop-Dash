/**
 * Etapa 02 — Filtros
 *
 * Permite definir condiciones que determinan qué registros se incluyen
 * en el reporte. Un array vacío significa "sin filtros: incluir todos".
 *
 * Componente controlado: el estado vive en ConfiguradorReporte.
 * Extensible: el catálogo (CAMPOS_FILTRO) agrega soporte por tipo_reporte
 * sin cambiar este componente.
 */
import { Plus, ListFilter } from "lucide-react";
import { Button }           from "@/components/ui";
import type { FiltroItem }  from "../../types";
import { CAMPOS_FILTRO }    from "./filtros/catalogoFiltros";
import { FiltroRow }        from "./filtros/FiltroRow";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function filtroInicial(tipoReporte: string): FiltroItem {
  const campos  = CAMPOS_FILTRO[tipoReporte] ?? [];
  const primero = campos[0];
  return {
    id:          newId(),
    campo:       primero?.campo    ?? "",
    operador:    primero?.operadores[0]?.id ?? "",
    valor:       null,
    valor_desde: null,
    valor_hasta: null,
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  filtros:      FiltroItem[];
  tipoReporte:  string;
  onChange:     (filtros: FiltroItem[]) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EtapaFiltros({ filtros, tipoReporte, onChange }: Props) {
  const camposDisponibles = CAMPOS_FILTRO[tipoReporte] ?? [];

  function agregarFiltro() {
    onChange([...filtros, filtroInicial(tipoReporte)]);
  }

  function actualizarFiltro(id: string, actualizado: FiltroItem) {
    onChange(filtros.map(f => f.id === id ? actualizado : f));
  }

  function eliminarFiltro(id: string) {
    onChange(filtros.filter(f => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: "640px" }}>

      {/* Encabezado */}
      <div>
        <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
          Filtros del reporte
        </p>
        <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
          Define qué registros se incluirán en el reporte.
          {filtros.length === 0 && (
            <> Sin filtros, se incluyen todos los registros.</>
          )}
        </p>
      </div>

      {/* Estado vacío */}
      {filtros.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-10 rounded-xl"
          style={{
            border:     "1.5px dashed var(--gray-200)",
            background: "var(--gray-50)",
            color:      "var(--gray-400)",
          }}
        >
          <ListFilter style={{ width: "28px", height: "28px", opacity: 0.5 }} />
          <p className="text-[13px] font-medium">Sin condiciones de filtrado</p>
          <p className="text-[12px]" style={{ color: "var(--gray-400)" }}>
            El reporte incluirá todos los viajes activos.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={agregarFiltro}
            disabled={camposDisponibles.length === 0}
          >
            <Plus style={{ width: "14px", height: "14px", marginRight: "5px" }} />
            Agregar primer filtro
          </Button>
        </div>
      )}

      {/* Lista de filtros */}
      {filtros.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {filtros.map(filtro => (
            <FiltroRow
              key={filtro.id}
              filtro={filtro}
              tipoReporte={tipoReporte}
              onChange={actualizado => actualizarFiltro(filtro.id, actualizado)}
              onEliminar={() => eliminarFiltro(filtro.id)}
            />
          ))}
        </div>
      )}

      {/* Botón agregar (cuando ya hay filtros) */}
      {filtros.length > 0 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={agregarFiltro}
            disabled={camposDisponibles.length === 0}
          >
            <Plus style={{ width: "14px", height: "14px", marginRight: "5px" }} />
            Agregar filtro
          </Button>
        </div>
      )}

      {/* Nota informativa */}
      {camposDisponibles.length > 0 && filtros.length > 0 && (
        <p className="text-[11.5px]" style={{ color: "var(--gray-400)" }}>
          Se aplicarán todos los filtros (condición AND). Los viajes que
          cumplan todas las condiciones serán incluidos en el reporte.
        </p>
      )}

    </div>
  );
}
