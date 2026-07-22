import { useState, useRef, useEffect } from "react";
import { CalendarDays, X } from "lucide-react";

const MAX_DAYS = 30;

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return toISO(new Date());
}

function labelRango(desde: string, hasta: string): string {
  if (desde === hasta) {
    const d = new Date(desde + "T00:00:00");
    const t = today();
    if (desde === t) return "Hoy";
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  }
  const d1 = new Date(desde + "T00:00:00");
  const d2 = new Date(hasta + "T00:00:00");
  return `${d1.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} – ${d2.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}`;
}

interface DateRangePickerProps {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}

export function DateRangePicker({ desde, hasta, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleDesde(val: string) {
    if (!val) return;
    let h = hasta;
    // Asegurar que hasta >= desde
    if (h < val) h = val;
    // Asegurar máximo 30 días
    const d1 = new Date(val + "T00:00:00");
    const d2 = new Date(h + "T00:00:00");
    const diffDays = (d2.getTime() - d1.getTime()) / 86_400_000;
    if (diffDays > MAX_DAYS) {
      h = toISO(new Date(d1.getTime() + MAX_DAYS * 86_400_000));
    }
    onChange(val, h);
  }

  function handleHasta(val: string) {
    if (!val) return;
    let d = desde;
    if (val < d) d = val;
    // Asegurar máximo 30 días
    const d1 = new Date(d + "T00:00:00");
    const d2 = new Date(val + "T00:00:00");
    const diffDays = (d2.getTime() - d1.getTime()) / 86_400_000;
    if (diffDays > MAX_DAYS) {
      d = toISO(new Date(d2.getTime() - MAX_DAYS * 86_400_000));
    }
    onChange(d, val);
  }

  function resetToday() {
    const t = today();
    onChange(t, t);
    setOpen(false);
  }

  const maxDesde = hasta;
  const minHasta = desde;
  const maxHasta = toISO(new Date(new Date(desde + "T00:00:00").getTime() + MAX_DAYS * 86_400_000));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[13px] outline-none"
        style={{
          border: "1.5px solid var(--gray-200)",
          borderRadius: 10,
          padding: "8px 12px",
          color: "var(--gray-700)",
          background: "#fff",
          minWidth: 160,
          cursor: "pointer",
        }}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
        <span className="flex-1 text-left">{labelRango(desde, hasta)}</span>
        {desde !== today() || hasta !== today() ? (
          <X
            className="w-3 h-3 shrink-0"
            style={{ color: "var(--gray-400)" }}
            onClick={(e) => { e.stopPropagation(); resetToday(); }}
          />
        ) : null}
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 flex flex-col gap-3"
          style={{
            background: "#fff",
            border: "1.5px solid var(--gray-200)",
            borderRadius: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            padding: "14px 16px",
            minWidth: 240,
            top: "100%",
            left: 0,
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--gray-400)" }}>
            Rango de fechas (máx. 30 días)
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: "var(--gray-500)" }}>Desde</span>
              <input
                type="date"
                value={desde}
                max={maxDesde}
                onChange={(e) => handleDesde(e.target.value)}
                className="text-[13px] outline-none"
                style={{
                  border: "1.5px solid var(--gray-200)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  color: "var(--gray-700)",
                  background: "#fff",
                }}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: "var(--gray-500)" }}>Hasta</span>
              <input
                type="date"
                value={hasta}
                min={minHasta}
                max={maxHasta}
                onChange={(e) => handleHasta(e.target.value)}
                className="text-[13px] outline-none"
                style={{
                  border: "1.5px solid var(--gray-200)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  color: "var(--gray-700)",
                  background: "#fff",
                }}
              />
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={resetToday}
              className="text-[12px] font-semibold"
              style={{ color: "var(--navy)", cursor: "pointer" }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const t = today();
                const d7 = toISO(new Date(new Date(t + "T00:00:00").getTime() - 6 * 86_400_000));
                onChange(d7, t);
              }}
              className="text-[12px] font-semibold"
              style={{ color: "var(--navy)", cursor: "pointer" }}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] ml-auto"
              style={{ color: "var(--gray-400)", cursor: "pointer" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
