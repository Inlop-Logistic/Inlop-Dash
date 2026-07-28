import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface ClienteFilterProps {
  /** Nombre del cliente seleccionado; string vacío = "Todos". */
  value: string;
  onChange: (v: string) => void;
  /** Lista de nombres únicos de clientes. Derivada por el módulo consumidor. */
  opciones: string[];
  placeholder?: string;
  ariaLabel?: string;
  minWidth?: number;
  /** 'sm' = padding 6px (GPS inline bar) | 'md' = padding 8px (FilterBar). */
  size?: "sm" | "md";
}

export function ClienteFilter({
  value,
  onChange,
  opciones,
  placeholder = "Todos los clientes",
  ariaLabel = "Filtrar por cliente",
  minWidth = 200,
  size = "md",
}: ClienteFilterProps) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const containerRef      = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  const py = size === "sm" ? "6px" : "8px";

  // Cierre al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus en el buscador al abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filteredOpciones = query
    ? opciones.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : opciones;

  const handleSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  const triggerStyle: React.CSSProperties = {
    border:       "1.5px solid var(--gray-200)",
    borderRadius: 10,
    padding:      `${py} 12px`,
    color:        "var(--gray-700)",
    background:   "#fff",
    minWidth,
    width:        "100%",
  };

  return (
    <div ref={containerRef} className="relative" style={{ minWidth }}>

      {/* Botón disparador */}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 text-[13px] text-left outline-none"
        style={triggerStyle}
      >
        <span
          className="truncate"
          style={{ color: value ? "var(--gray-700)" : "var(--gray-400)" }}
        >
          {value || placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              aria-label="Limpiar filtro de cliente"
              onClick={handleClear}
              className="rounded-full p-0.5 transition-colors"
              style={{ color: "var(--gray-400)" }}
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5"
            style={{
              color:     "var(--gray-400)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 150ms ease",
            }}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 flex flex-col"
          style={{
            width:      "100%",
            minWidth:   Math.max(minWidth, 240),
            background: "#fff",
            border:     "1.5px solid var(--gray-200)",
            borderRadius: 12,
            boxShadow:  "0 8px 24px rgba(0,0,0,0.10)",
            overflow:   "hidden",
            zIndex:     50,
          }}
        >
          {/* Búsqueda */}
          <div
            className="px-2.5 pt-2.5 pb-2"
            style={{ borderBottom: "1px solid var(--gray-100)" }}
          >
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "var(--gray-400)" }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full text-[13px] outline-none"
                style={{
                  border:       "1.5px solid var(--gray-200)",
                  borderRadius: 8,
                  padding:      "6px 10px 6px 30px",
                  color:        "var(--gray-700)",
                  background:   "var(--gray-50)",
                }}
              />
            </div>
          </div>

          {/* Lista de opciones */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: 220 }}
            role="listbox"
            aria-label={ariaLabel}
          >
            {/* Opción "Todos" */}
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onClick={() => handleSelect("")}
              className="w-full text-left px-3.5 py-2.5 text-[13px] transition-colors"
              style={{
                color:      value === "" ? "var(--navy)" : "var(--gray-500)",
                fontWeight: value === "" ? 600 : 400,
                background: value === "" ? "#EFF6FF" : "transparent",
              }}
            >
              {placeholder}
            </button>

            {filteredOpciones.length === 0 ? (
              <div
                className="px-3.5 py-3 text-[12px] text-center"
                style={{ color: "var(--gray-400)" }}
              >
                Sin resultados
              </div>
            ) : (
              filteredOpciones.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={value === opt}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left px-3.5 py-2.5 text-[13px] transition-colors"
                  style={{
                    color:      value === opt ? "var(--navy)" : "var(--gray-700)",
                    fontWeight: value === opt ? 600 : 400,
                    background: value === opt ? "#EFF6FF" : "transparent",
                  }}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
