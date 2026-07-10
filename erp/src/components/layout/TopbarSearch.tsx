import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Search, X, Clock, ArrowRight,
  LayoutDashboard, ClipboardList, Truck, Map, AlertTriangle,
} from "lucide-react";

// ── Módulos disponibles en la búsqueda estática ───────────────────────────
// Futura integración: reemplazar con resultados de Supabase full-text search.
// La forma del objeto (id, label, description, icon) es la interfaz pública
// que el backend deberá respetar al devolver resultados.

interface SearchModule {
  id:          string;
  label:       string;
  description: string;
  icon:        ReactNode;
}

const MODULES: SearchModule[] = [
  { id: "dashboard",   label: "Inicio",      description: "Panel principal del ERP",          icon: <LayoutDashboard className="w-[17px] h-[17px]" /> },
  { id: "solicitudes", label: "Solicitudes",  description: "Gestión de solicitudes de servicio", icon: <ClipboardList   className="w-[17px] h-[17px]" /> },
  { id: "viajes",      label: "Viajes",       description: "Control y seguimiento de viajes",  icon: <Truck           className="w-[17px] h-[17px]" /> },
  { id: "mapa",        label: "Mapa GPS",     description: "Seguimiento en tiempo real",       icon: <Map             className="w-[17px] h-[17px]" /> },
  { id: "alarmas",     label: "Alarmas",      description: "Sistema de alertas del ERP",       icon: <AlertTriangle   className="w-[17px] h-[17px]" /> },
];

// Detectar Mac para mostrar ⌘K vs Ctrl K
const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  // Callback de navegación — AppShell hace el cast a Vista internamente
  onNavigate: (id: string) => void;
}

// ── Componente ────────────────────────────────────────────────────────────

export function TopbarSearch({ onNavigate }: Props) {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const modalRef   = useRef<HTMLDivElement>(null);

  // ── Apertura / Cierre ───────────────────────────────────────────────────

  const openSearch = () => {
    setOpen(true);
    setQuery("");
    setSelected(-1);
  };

  const closeSearch = () => {
    setOpen(false);
    setSelected(-1);
    // Devolver foco al trigger para accesibilidad de teclado
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  // ── Atajo global Ctrl+K / ⌘K ────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => { if (prev) { closeSearch(); return false; } openSearch(); return true; });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []); // setOpen es estable — sin deps adicionales

  // ── Autofocus al abrir ──────────────────────────────────────────────────

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // ── Escape cierra ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ── Click fuera del modal cierra ────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) closeSearch();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Filtrado ────────────────────────────────────────────────────────────

  const filtered = query.trim()
    ? MODULES.filter((m) =>
        m.label.toLowerCase().includes(query.toLowerCase().trim()) ||
        m.description.toLowerCase().includes(query.toLowerCase().trim())
      )
    : MODULES;

  // ── Navegación por teclado en la lista ─────────────────────────────────

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, -1));
    } else if (e.key === "Enter" && selected >= 0 && filtered[selected]) {
      handleNavigate(filtered[selected].id);
    }
  };

  const handleNavigate = (id: string) => {
    onNavigate(id);
    closeSearch();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger: pill en desktop, ícono en tablet/móvil ─────────────── */}

      {/* Desktop / lg: pill completa */}
      <button
        ref={triggerRef}
        onClick={openSearch}
        aria-label="Abrir búsqueda global"
        aria-keyshortcuts={IS_MAC ? "Meta+k" : "Control+k"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          "hidden lg:flex items-center gap-2 h-9 px-3 w-full",
          "max-w-[280px]",
          "rounded-[var(--radius-lg)] border border-[var(--gray-200)]",
          "bg-[var(--gray-50)] hover:bg-white hover:border-[var(--gray-300)]",
          "text-[var(--gray-400)] transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)] focus-visible:ring-offset-1",
        ].join(" ")}
      >
        <Search aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left text-[var(--text-sm)] truncate">
          Buscar en INLOP ERP...
        </span>
        <kbd
          className="hidden xl:inline-flex items-center shrink-0 gap-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded select-none"
          style={{
            background:  "var(--gray-100)",
            border:      "1px solid var(--gray-200)",
            color:       "var(--gray-500)",
            lineHeight:  1.4,
          }}
        >
          {IS_MAC ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Tablet / md: ícono solamente */}
      <button
        onClick={openSearch}
        aria-label="Abrir búsqueda global"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          "flex lg:hidden items-center justify-center w-8 h-8",
          "rounded-[var(--radius-md)]",
          "hover:bg-[var(--gray-100)] transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]",
        ].join(" ")}
        style={{ color: "var(--gray-500)" }}
      >
        <Search aria-hidden="true" className="w-4 h-4" />
      </button>

      {/* ── Command Palette Modal ─────────────────────────────────────────── */}

      {open && (
        /* Overlay */
        <div
          className="fixed inset-0 flex items-start justify-center pt-[8vh] px-4"
          style={{
            background: "rgba(15,23,42,0.48)",
            zIndex: "var(--z-modal)",
            animation: "topbar-overlay-in 120ms ease",
          }}
          aria-hidden={!open}
        >
          {/* Modal card */}
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Búsqueda global"
            className="w-full overflow-hidden"
            style={{
              maxWidth:     "560px",
              background:   "#fff",
              borderRadius: "var(--radius-2xl)",
              border:       "1px solid var(--gray-100)",
              boxShadow:    "0 24px 48px -8px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
              animation:    "topbar-search-in 160ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >

            {/* Input row */}
            <div
              className="flex items-center gap-3 px-4"
              style={{ height: "52px", borderBottom: "1px solid var(--gray-100)" }}
            >
              <Search aria-hidden="true" className="w-4 h-4 shrink-0" style={{ color: "var(--gray-400)" }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(-1); }}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar módulos, solicitudes, viajes..."
                aria-label="Búsqueda global"
                aria-controls="search-results"
                aria-activedescendant={selected >= 0 ? `search-item-${selected}` : undefined}
                className="flex-1 text-[var(--text-md)] bg-transparent outline-none"
                style={{ color: "var(--gray-900)" }}
              />
              <button
                onClick={closeSearch}
                aria-label="Cerrar búsqueda"
                className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] hover:bg-[var(--gray-100)] transition-colors"
                style={{ color: "var(--gray-400)" }}
              >
                <X aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Results */}
            <div className="px-2 py-2">

              {/* Section label */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5 select-none"
                aria-hidden="true"
              >
                {!query && <Clock aria-hidden="true" className="w-3 h-3" style={{ color: "var(--gray-400)" }} />}
                <span
                  className="text-[var(--text-xs)] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--gray-400)", letterSpacing: "0.08em" }}
                >
                  {query ? "Módulos" : "Recientes"}
                </span>
              </div>

              {/* Items */}
              <div id="search-results" role="listbox" aria-label={query ? "Módulos encontrados" : "Módulos recientes"}>
                {filtered.length > 0 ? (
                  filtered.map((module, idx) => (
                    <button
                      key={module.id}
                      id={`search-item-${idx}`}
                      role="option"
                      aria-selected={selected === idx}
                      onClick={() => handleNavigate(module.id)}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left group",
                        "rounded-[var(--radius-lg)] transition-colors duration-100",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)] focus-visible:ring-inset",
                        selected === idx
                          ? "bg-[var(--gray-50)]"
                          : "hover:bg-[var(--gray-50)]",
                      ].join(" ")}
                    >
                      {/* Module icon tile */}
                      <div
                        className="shrink-0 w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
                        style={{ background: "var(--gray-100)", color: "var(--navy)" }}
                      >
                        {module.icon}
                      </div>

                      {/* Labels */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[var(--text-md)] font-medium leading-tight truncate"
                          style={{ color: "var(--gray-800)" }}
                        >
                          {module.label}
                        </div>
                        <div
                          className="text-[var(--text-xs)] leading-tight truncate mt-0.5"
                          style={{ color: "var(--gray-400)" }}
                        >
                          {module.description}
                        </div>
                      </div>

                      {/* Arrow — visible on hover / keyboard selection */}
                      <ArrowRight
                        aria-hidden="true"
                        className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                        style={{ color: "var(--gray-500)" }}
                      />
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center">
                    <div className="text-[var(--text-md)] font-medium mb-1" style={{ color: "var(--gray-600)" }}>
                      Sin resultados para "{query}"
                    </div>
                    <div className="text-[var(--text-sm)]" style={{ color: "var(--gray-400)" }}>
                      Intenta con el nombre del módulo
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer — próximamente */}
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--gray-100)", background: "var(--gray-50)" }}
            >
              <Search aria-hidden="true" className="w-3 h-3 shrink-0" style={{ color: "var(--gray-300)" }} />
              <span className="text-[var(--text-xs)]" style={{ color: "var(--gray-400)" }}>
                Próximamente: buscar solicitudes, viajes, vehículos y clientes directamente.
              </span>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
