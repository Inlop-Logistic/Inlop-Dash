/**
 * Etapa 04 — Frecuencia
 *
 * Configura la periodicidad de ejecución del reporte: tipo de frecuencia,
 * una o varias horas de disparo, los días que aplican según el tipo, y el
 * rango de repetición (comienzo obligatorio + una única modalidad de fin).
 *
 * La estructura persistida (RecurrenciaReporte) no es texto libre — queda
 * lista para que un scheduler futuro calcule la próxima ejecución sin
 * reinterpretar nada. Ver types.ts para el modelo completo.
 *
 * Componente controlado: el estado vive en ConfiguradorReporte. No usa
 * estado local — cada mutación se propaga de inmediato vía onChange, igual
 * que EtapaFiltros.
 */
import { Plus, Trash2, Clock } from "lucide-react";
import { Button }              from "@/components/ui";
import {
  DIAS_SEMANA,
  type TipoFrecuencia,
  type RecurrenciaReporte,
  type FinRecurrencia,
  cambiarTipoFrecuencia,
} from "../../types";

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: "var(--radius-lg)",
  color:        "var(--gray-700)",
  background:   "#fff",
  outline:      "none",
  fontSize:     "13px",
  padding:      "8px 10px",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:     "12px",
  fontWeight:   600,
  color:        "var(--gray-600)",
  display:      "block",
  marginBottom: "8px",
};

const TIPOS: { value: TipoFrecuencia; label: string; desc: string }[] = [
  { value: "diaria",  label: "Diaria",  desc: "Se ejecuta todos los días" },
  { value: "semanal", label: "Semanal", desc: "Se ejecuta en los días que elijas" },
  { value: "mensual", label: "Mensual", desc: "Se ejecuta un día fijo del mes" },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  recurrencia: RecurrenciaReporte;
  onChange:    (r: RecurrenciaReporte) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EtapaFrecuencia({ recurrencia, onChange }: Props) {
  const r = recurrencia;

  function set<K extends keyof RecurrenciaReporte>(key: K, value: RecurrenciaReporte[K]) {
    onChange({ ...r, [key]: value });
  }

  // ── Tipo de frecuencia ────────────────────────────────────────────────────

  function handleTipoChange(tipo: TipoFrecuencia) {
    onChange(cambiarTipoFrecuencia(r, tipo));
  }

  // ── Horas de envío ────────────────────────────────────────────────────────

  function agregarHora() {
    set("horas", [...r.horas, "08:00"]);
  }

  function actualizarHora(index: number, valor: string) {
    set("horas", r.horas.map((h, i) => (i === index ? valor : h)));
  }

  function eliminarHora(index: number) {
    if (r.horas.length <= 1) return; // al menos una hora siempre
    set("horas", r.horas.filter((_, i) => i !== index));
  }

  // ── Días de la semana (solo semanal) ──────────────────────────────────────

  function toggleDiaSemana(dia: number) {
    const actuales = r.dias_semana ?? [];
    const next = actuales.includes(dia)
      ? actuales.filter(d => d !== dia)
      : [...actuales, dia].sort((a, b) => a - b);
    set("dias_semana", next);
  }

  // ── Finalización del rango ────────────────────────────────────────────────

  function setFin(fin: FinRecurrencia) {
    set("fin", fin);
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">

      <div>
        <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
          Frecuencia del reporte
        </p>
        <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
          Define cada cuánto se genera el reporte, a qué hora(s), y hasta cuándo se repite.
        </p>
      </div>

      {/* ── Tipo de frecuencia ── */}
      <div>
        <label style={LABEL_STYLE}>Tipo de frecuencia</label>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map(t => {
            const activo = r.tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTipoChange(t.value)}
                className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{
                  border:     `1.5px solid ${activo ? "var(--navy)" : "var(--gray-200)"}`,
                  background: activo ? "rgba(1, 42, 107, 0.06)" : "#fff",
                  cursor:     "pointer",
                }}
              >
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: activo ? "var(--navy)" : "var(--gray-700)" }}
                >
                  {t.label}
                </span>
                <span className="text-[11px]" style={{ color: "var(--gray-400)" }}>
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Días de la semana (solo semanal) ── */}
      {r.tipo === "semanal" && (
        <div>
          <label style={LABEL_STYLE}>Días de la semana</label>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map(dia => {
              const activo = (r.dias_semana ?? []).includes(dia.value);
              return (
                <button
                  key={dia.value}
                  type="button"
                  onClick={() => toggleDiaSemana(dia.value)}
                  className="px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors"
                  style={{
                    border:     `1.5px solid ${activo ? "var(--navy)" : "var(--gray-200)"}`,
                    background: activo ? "var(--navy)" : "#fff",
                    color:      activo ? "#fff" : "var(--gray-600)",
                    cursor:     "pointer",
                  }}
                >
                  {dia.label}
                </button>
              );
            })}
          </div>
          {(r.dias_semana?.length ?? 0) === 0 && (
            <p className="text-[11.5px] mt-1.5" style={{ color: "var(--inlop-red)" }}>
              Selecciona al menos un día.
            </p>
          )}
        </div>
      )}

      {/* ── Día del mes (solo mensual) ── */}
      {r.tipo === "mensual" && (
        <div style={{ maxWidth: "160px" }}>
          <label style={LABEL_STYLE}>Día del mes</label>
          <input
            type="number"
            min={1}
            max={31}
            value={r.dia_mes ?? ""}
            onChange={e => {
              const v = e.target.value === "" ? undefined : Number(e.target.value);
              set("dia_mes", v === undefined ? undefined : Math.min(31, Math.max(1, v)));
            }}
            placeholder="Ej. 1"
            style={{ ...INPUT_STYLE, width: "100%" }}
          />
          {!r.dia_mes && (
            <p className="text-[11.5px] mt-1.5" style={{ color: "var(--inlop-red)" }}>
              Indica el día del mes (1-31).
            </p>
          )}
        </div>
      )}

      {/* ── Horas de envío ── */}
      <div>
        <label style={LABEL_STYLE}>Hora(s) de envío</label>
        <div className="flex flex-col gap-2">
          {r.horas.map((hora, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
              <input
                type="time"
                value={hora}
                onChange={e => actualizarHora(idx, e.target.value)}
                style={{ ...INPUT_STYLE, width: "140px" }}
              />
              <button
                type="button"
                aria-label="Eliminar hora"
                onClick={() => eliminarHora(idx)}
                disabled={r.horas.length <= 1}
                className="shrink-0 flex items-center justify-center rounded-md transition-colors disabled:opacity-25"
                style={{
                  width: "28px", height: "28px",
                  color: "var(--gray-400)",
                  cursor: r.horas.length <= 1 ? "default" : "pointer",
                }}
              >
                <Trash2 style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={agregarHora} icon={<Plus className="w-3.5 h-3.5" />} style={{ marginTop: "6px" }}>
          Agregar hora
        </Button>
      </div>

      {/* ── Rango de repetición ── */}
      <div>
        <label style={LABEL_STYLE}>Rango de repetición</label>

        <div className="flex flex-col gap-4 p-4 rounded-xl" style={{ border: "1.5px solid var(--gray-200)", background: "var(--gray-50)" }}>

          {/* Comienzo */}
          <div>
            <span className="text-[12px] font-medium block mb-1.5" style={{ color: "var(--gray-600)" }}>
              Comienzo <span style={{ color: "var(--inlop-red)" }}>*</span>
            </span>
            <input
              type="date"
              value={r.fecha_inicio}
              onChange={e => set("fecha_inicio", e.target.value)}
              style={{ ...INPUT_STYLE, width: "170px", background: "#fff" }}
            />
          </div>

          {/* Modalidad de finalización — mutuamente excluyentes */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-medium" style={{ color: "var(--gray-600)" }}>
              Finalización
            </span>

            {/* Sin fecha de finalización */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="fin-modo"
                checked={r.fin.modo === "nunca"}
                onChange={() => setFin({ modo: "nunca" })}
              />
              <span className="text-[13px]" style={{ color: "var(--gray-700)" }}>
                Sin fecha de finalización
              </span>
            </label>

            {/* Finalizar el */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="fin-modo"
                checked={r.fin.modo === "fecha"}
                onChange={() => setFin({ modo: "fecha", fecha: r.fecha_inicio })}
              />
              <span className="text-[13px] shrink-0" style={{ color: "var(--gray-700)" }}>
                Finalizar el
              </span>
              <input
                type="date"
                value={r.fin.modo === "fecha" ? r.fin.fecha : ""}
                onChange={e => setFin({ modo: "fecha", fecha: e.target.value })}
                disabled={r.fin.modo !== "fecha"}
                style={{ ...INPUT_STYLE, width: "170px", background: "#fff", opacity: r.fin.modo === "fecha" ? 1 : 0.5 }}
              />
            </label>

            {/* Finalizar después de N repeticiones */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="fin-modo"
                checked={r.fin.modo === "repeticiones"}
                onChange={() => setFin({ modo: "repeticiones", cantidad: 1 })}
              />
              <span className="text-[13px] shrink-0" style={{ color: "var(--gray-700)" }}>
                Finalizar después de
              </span>
              <input
                type="number"
                min={1}
                value={r.fin.modo === "repeticiones" ? r.fin.cantidad : ""}
                onChange={e => setFin({ modo: "repeticiones", cantidad: Math.max(1, Number(e.target.value) || 1) })}
                disabled={r.fin.modo !== "repeticiones"}
                style={{ ...INPUT_STYLE, width: "72px", background: "#fff", opacity: r.fin.modo === "repeticiones" ? 1 : 0.5 }}
              />
              <span className="text-[13px]" style={{ color: "var(--gray-700)" }}>
                repeticiones
              </span>
            </label>
          </div>
        </div>
      </div>

    </div>
  );
}
