import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { CalendarDays, X } from "lucide-react";
import { fechaHoyColombia, sumarDias } from "@/utils/date";

const MAX_DAYS = 30;

// Formatea un string YYYY-MM-DD para label de rango (DD mmm), usando siempre
// Colombia timezone. Construye a mediodía UTC para evitar cualquier ambigüedad
// de día en cualquier timezone del browser.
function fmtLabel(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day:   "2-digit",
    month: "short",
  });
}

// Días de diferencia entre dos strings YYYY-MM-DD (UTC-safe).
function diffDays(desde: string, hasta: string): number {
  const [Y1, M1, D1] = desde.split("-").map(Number);
  const [Y2, M2, D2] = hasta.split("-").map(Number);
  return (Date.UTC(Y2, M2 - 1, D2) - Date.UTC(Y1, M1 - 1, D1)) / 86_400_000;
}

function labelRango(desde: string, hasta: string): string {
  if (!desde && !hasta) return "";
  if (desde === hasta) {
    if (desde === fechaHoyColombia()) return "Hoy";
    return fmtLabel(desde);
  }
  return `${fmtLabel(desde)} – ${fmtLabel(hasta)}`;
}

interface DateRangePickerProps {
  /** Valor aplicado actualmente. Cadena vacía = sin filtro. */
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}

export function DateRangePicker({ desde, hasta, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Estado borrador — solo se propaga al padre al presionar Aplicar.
  const [draftDesde, setDraftDesde] = useState(desde);
  const [draftHasta, setDraftHasta] = useState(hasta);

  // Posición del popover: calculada al abrir para evitar salir del viewport.
  const [openUp, setOpenUp]       = useState(false);
  const [openRight, setOpenRight] = useState(false);

  const wrapRef   = useRef<HTMLDivElement>(null);
  const popRef    = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sincronizar borrador cuando el padre limpia el filtro externamente.
  useEffect(() => {
    if (!open) {
      setDraftDesde(desde);
      setDraftHasta(hasta);
    }
  }, [desde, hasta, open]);

  // Detectar posición al abrir para evitar clipping contra el viewport.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setOpenUp(rect.bottom + 280 > window.innerHeight);
    setOpenRight(rect.right - 250 < 0);
  }, [open]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleDesde(val: string) {
    setDraftDesde(val);
    if (draftHasta && val) {
      // YYYY-MM-DD strings son comparables lexicográficamente.
      if (draftHasta < val) {
        setDraftHasta(val);
      } else if (diffDays(val, draftHasta) > MAX_DAYS) {
        setDraftHasta(sumarDias(val, MAX_DAYS));
      }
    }
  }

  function handleHasta(val: string) {
    setDraftHasta(val);
    if (draftDesde && val) {
      if (val < draftDesde) {
        setDraftDesde(val);
      } else if (diffDays(draftDesde, val) > MAX_DAYS) {
        setDraftDesde(sumarDias(val, -MAX_DAYS));
      }
    }
  }

  function aplicar() {
    const d = draftDesde || "";
    const h = draftHasta || draftDesde || "";
    onChange(d, h);
    setOpen(false);
  }

  function limpiar(e: React.MouseEvent) {
    e.stopPropagation();
    setDraftDesde("");
    setDraftHasta("");
    onChange("", "");
  }

  function shortcut(d: string, h: string) {
    setDraftDesde(d);
    setDraftHasta(h);
  }

  const label     = labelRango(desde, hasta);
  const hayFiltro = desde !== "" || hasta !== "";

  // Límite superior de "hasta" según MAX_DAYS a partir de "desde".
  const maxHastaConstraint = draftDesde ? sumarDias(draftDesde, MAX_DAYS) : "";

  const popoverStyle: React.CSSProperties = {
    position:      "absolute",
    zIndex:        50,
    background:    "#fff",
    border:        "1.5px solid var(--gray-200)",
    borderRadius:  12,
    boxShadow:     "0 4px 20px rgba(0,0,0,0.12)",
    padding:       "14px 16px",
    minWidth:      240,
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    ...(openUp
      ? { bottom: "calc(100% + 6px)", top:    "auto" }
      : { top:    "calc(100% + 6px)", bottom: "auto" }),
    ...(openRight
      ? { left: 0,   right: "auto" }
      : { right: 0,  left:  "auto" }),
  };

  // Shortcuts preestablecidos — todos calculados en hora Colombia.
  // Para añadir nuevos rangos rápidos, agregar una entrada a este array.
  const hoy      = fechaHoyColombia();
  const manana   = sumarDias(hoy, 1);
  const SHORTCUTS = [
    { label: "Hoy",         d: hoy,                 h: hoy    },
    { label: "Mañana",      d: manana,               h: manana },
    { label: "Últimos 7d",  d: sumarDias(hoy, -6),  h: hoy    },
    { label: "Últimos 30d", d: sumarDias(hoy, -29), h: hoy    },
  ];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[13px] outline-none"
        style={{
          border:       `1.5px solid ${hayFiltro ? "var(--navy)" : "var(--gray-200)"}`,
          borderRadius: 10,
          padding:      "8px 12px",
          color:        hayFiltro ? "var(--navy)" : "var(--gray-400)",
          background:   hayFiltro ? "#EEF2FF" : "#fff",
          minWidth:     160,
          cursor:       "pointer",
          fontWeight:   hayFiltro ? 600 : 400,
        }}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">
          {label || "Fecha"}
        </span>
        {hayFiltro && (
          <X
            className="w-3 h-3 shrink-0"
            style={{ color: "var(--navy)" }}
            onClick={limpiar}
          />
        )}
      </button>

      {open && (
        <div ref={popRef} style={popoverStyle}>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--gray-400)" }}
          >
            Rango de fechas (máx. {MAX_DAYS} días)
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: "var(--gray-500)" }}>Desde</span>
              <input
                type="date"
                value={draftDesde}
                max={draftHasta || undefined}
                onChange={(e) => handleDesde(e.target.value)}
                className="text-[13px] outline-none"
                style={{
                  border:       "1.5px solid var(--gray-200)",
                  borderRadius: 8,
                  padding:      "5px 8px",
                  color:        "var(--gray-700)",
                  background:   "#fff",
                }}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: "var(--gray-500)" }}>Hasta</span>
              <input
                type="date"
                value={draftHasta}
                min={draftDesde || undefined}
                max={maxHastaConstraint || undefined}
                onChange={(e) => handleHasta(e.target.value)}
                className="text-[13px] outline-none"
                style={{
                  border:       "1.5px solid var(--gray-200)",
                  borderRadius: 8,
                  padding:      "5px 8px",
                  color:        "var(--gray-700)",
                  background:   "#fff",
                }}
              />
            </label>
          </div>

          {/* Shortcuts */}
          <div className="flex gap-2 flex-wrap">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => shortcut(s.d, s.h)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  border:     "1px solid var(--gray-200)",
                  color:      "var(--gray-600)",
                  background: draftDesde === s.d && draftHasta === s.h ? "var(--gray-100)" : "#fff",
                  cursor:     "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--gray-100)" }}>
            <button
              type="button"
              onClick={() => { setDraftDesde(""); setDraftHasta(""); }}
              className="text-[12px]"
              style={{ color: "var(--gray-400)", cursor: "pointer" }}
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={!draftDesde}
              className="ml-auto text-[12px] font-semibold px-3 py-1 rounded-lg"
              style={{
                background: draftDesde ? "var(--navy)" : "var(--gray-100)",
                color:      draftDesde ? "#fff" : "var(--gray-300)",
                cursor:     draftDesde ? "pointer" : "default",
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
