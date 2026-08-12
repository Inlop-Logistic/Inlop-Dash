/**
 * FiltroRow — Una fila de filtro en el configurador.
 *
 * Controles: Campo → Operador → Valor (según tipo de operador) → Eliminar.
 * Al cambiar el campo, el operador se reinicia al primero disponible.
 * Al cambiar el operador, el valor se limpia.
 */
import { Trash2 } from "lucide-react";
import type { FiltroItem }              from "../../../types";
import type { CampoFiltroConfig, OperadorConfig } from "./catalogoFiltros";
import { CAMPOS_FILTRO }               from "./catalogoFiltros";
import { SelectorClientes }            from "./SelectorClientes";

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: "var(--radius-lg)",
  color:        "var(--gray-700)",
  background:   "#fff",
  fontSize:     "13px",
  padding:      "7px 10px",
  outline:      "none",
};

const INPUT_DATE_STYLE: React.CSSProperties = {
  ...SELECT_STYLE,
  minWidth: "130px",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface FiltroRowProps {
  filtro:      FiltroItem;
  tipoReporte: string;
  onChange:    (f: FiltroItem) => void;
  onEliminar:  () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FiltroRow({ filtro, tipoReporte, onChange, onEliminar }: FiltroRowProps) {
  const campos     = CAMPOS_FILTRO[tipoReporte] ?? [];
  const campoCfg   = campos.find(c => c.campo === filtro.campo);
  const operadorCfg = campoCfg?.operadores.find(o => o.id === filtro.operador);

  function handleCampoChange(campo: string) {
    const nuevoCampo     = campos.find(c => c.campo === campo);
    const primerOperador = nuevoCampo?.operadores[0];
    onChange({
      ...filtro,
      campo,
      operador:    primerOperador?.id ?? "",
      valor:       null,
      valor_desde: null,
      valor_hasta: null,
      valores:     undefined,
    });
  }

  function handleOperadorChange(operador: string) {
    onChange({
      ...filtro,
      operador,
      valor:       null,
      valor_desde: null,
      valor_hasta: null,
      valores:     undefined,
    });
  }

  return (
    <div
      className="flex items-center gap-2 flex-wrap p-3 rounded-xl"
      style={{
        background: "var(--gray-50)",
        border:     "1.5px solid var(--gray-200)",
      }}
    >
      {/* Campo */}
      <select
        value={filtro.campo}
        onChange={e => handleCampoChange(e.target.value)}
        style={{ ...SELECT_STYLE, minWidth: "170px" }}
        aria-label="Campo del filtro"
      >
        <option value="">— Campo —</option>
        {campos.map(c => (
          <option key={c.campo} value={c.campo}>{c.label}</option>
        ))}
      </select>

      {/* Operador — solo si se eligió un campo */}
      {campoCfg && (
        <select
          value={filtro.operador}
          onChange={e => handleOperadorChange(e.target.value)}
          style={{ ...SELECT_STYLE, minWidth: "120px" }}
          aria-label="Operador del filtro"
        >
          {campoCfg.operadores.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}

      {/* Valor — depende del tipo de operador */}
      {campoCfg && operadorCfg && (
        <ValorControl
          campoCfg={campoCfg}
          operadorCfg={operadorCfg}
          filtro={filtro}
          tipoReporte={tipoReporte}
          onChange={onChange}
        />
      )}

      {/* Spacer */}
      <span style={{ flex: "1 1 0" }} />

      {/* Eliminar */}
      <button
        type="button"
        onClick={onEliminar}
        title="Eliminar filtro"
        className="p-1.5 rounded-lg transition-colors shrink-0"
        style={{ color: "var(--gray-400)" }}
        onMouseOver={e => (e.currentTarget.style.color = "var(--inlop-red)")}
        onMouseOut={e  => (e.currentTarget.style.color = "var(--gray-400)")}
      >
        <Trash2 style={{ width: "15px", height: "15px" }} />
      </button>
    </div>
  );
}

// ─── Control de valor según tipoValor del operador ───────────────────────────

function ValorControl({
  campoCfg,
  operadorCfg,
  filtro,
  tipoReporte,
  onChange,
}: {
  campoCfg:    CampoFiltroConfig;
  operadorCfg: OperadorConfig;
  filtro:      FiltroItem;
  tipoReporte: string;
  onChange:    (f: FiltroItem) => void;
}) {
  switch (operadorCfg.tipoValor) {
    case "ninguno":
      return null;

    // Fase 11A — filtro "Cliente": opciones cargadas en vivo, no del catálogo.
    case "multiselect":
      return (
        <SelectorClientes
          tipoReporte={tipoReporte}
          valores={filtro.valores ?? []}
          onChange={valores => onChange({ ...filtro, valores })}
        />
      );

    case "select":
      return (
        <select
          value={filtro.valor ?? ""}
          onChange={e => onChange({ ...filtro, valor: e.target.value || null })}
          style={{ ...SELECT_STYLE, minWidth: "170px" }}
          aria-label="Valor del filtro"
        >
          <option value="">— Valor —</option>
          {(campoCfg.opciones ?? []).map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          type="date"
          value={filtro.valor ?? ""}
          onChange={e => onChange({ ...filtro, valor: e.target.value || null })}
          style={INPUT_DATE_STYLE}
          aria-label="Fecha del filtro"
        />
      );

    case "date_range":
      return (
        <>
          <input
            type="date"
            value={filtro.valor_desde ?? ""}
            onChange={e => onChange({ ...filtro, valor_desde: e.target.value || null })}
            style={INPUT_DATE_STYLE}
            aria-label="Fecha desde"
          />
          <span
            className="text-[12px] shrink-0"
            style={{ color: "var(--gray-400)" }}
          >
            y
          </span>
          <input
            type="date"
            value={filtro.valor_hasta ?? ""}
            onChange={e => onChange({ ...filtro, valor_hasta: e.target.value || null })}
            style={INPUT_DATE_STYLE}
            aria-label="Fecha hasta"
          />
        </>
      );

    default:
      return null;
  }
}
