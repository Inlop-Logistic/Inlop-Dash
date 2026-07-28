import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  // Posición fija del dropdown calculada en el momento de abrir
  const [pos, setPos]     = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const py = size === "sm" ? "6px" : "8px";

  /** Calcula posición viewport del dropdown al abrir y lo muestra. */
  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top:   rect.bottom + 4,
        left:  rect.left,
        width: Math.max(rect.width, 240),
      });
    }
    setOpen((prev) => !prev);
  };

  // Cierre al hacer clic fuera — revisa tanto el trigger como el portal
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
      setQuery("");
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

  // El dropdown se renderiza en document.body vía Portal.
  // Esto escapa cualquier stacking context (incluyendo los z-indexes de Leaflet)
  // y garantiza visibilidad sobre mapas, modales y cualquier otro elemento posicionado.
  const dropdownPortal =
    open && pos
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position:     "fixed",
              top:          pos.top,
              left:         pos.left,
              width:        pos.width,
              zIndex:       9999,
              background:   "#fff",
              border:       "1.5px solid var(--gray-200)",
              borderRadius: 12,
              boxShadow:    "0 8px 24px rgba(0,0,0,0.12)",
              overflow:     "hidden",
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div style={{ minWidth, position: "relative" }}>
      {/* Botón disparador */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
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
              color:      "var(--gray-400)",
              transform:  open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 150ms ease",
            }}
          />
        </span>
      </button>

      {dropdownPortal}
    </div>
  );
}
