import { useState, useEffect, useRef } from "react";
import { ChevronDown, User, Settings, HelpCircle, LogOut, Briefcase } from "lucide-react";

// ── Interfaz pública del perfil de usuario ────────────────────────────────────
// Subconjunto del perfil Supabase que el componente necesita renderizar.
// AppShell extrae estos campos de AuthContext y los pasa como prop.

export interface UserMenuProfile {
  nombre:  string;
  cargo?:  string;
  email?:  string;
}

// ── Definición de opciones del menú ───────────────────────────────────────────

interface MenuItem {
  id:      string;
  label:   string;
  icon:    React.ReactNode;
  danger?: boolean;
  action?: () => void;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  profile:  UserMenuProfile;
  onSignOut: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TopbarUserMenu({ profile, onSignOut }: Props) {
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // ── Abrir / Cerrar ──────────────────────────────────────────────────────────

  const closeMenu = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const toggle = () => setOpen((prev) => !prev);

  // ── Escape cierra ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ── Click fuera cierra ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) closeMenu();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Navegación por teclado dentro del menú ─────────────────────────────────

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
    if (!items || items.length === 0) return;
    const arr  = Array.from(items);
    const curr = document.activeElement as HTMLButtonElement;
    const idx  = arr.indexOf(curr);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      arr[(idx + 1) % arr.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      arr[(idx - 1 + arr.length) % arr.length]?.focus();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  };

  // ── Opciones del menú ───────────────────────────────────────────────────────

  const MENU_ITEMS: (MenuItem | "separator")[] = [
    {
      id:     "perfil",
      label:  "Mi perfil",
      icon:   <User aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined, // futuro
    },
    {
      id:     "preferencias",
      label:  "Preferencias",
      icon:   <Settings aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined, // futuro
    },
    {
      id:     "ayuda",
      label:  "Ayuda",
      icon:   <HelpCircle aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined, // futuro
    },
    "separator",
    {
      id:     "signout",
      label:  "Cerrar sesión",
      icon:   <LogOut aria-hidden="true" className="w-3.5 h-3.5" />,
      danger: true,
      action: () => { closeMenu(); onSignOut(); },
    },
  ];

  const initial = profile.nombre.charAt(0).toUpperCase();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* ── Trigger ────────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label={`Menú de usuario — ${profile.nombre}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          "flex items-center gap-2 h-8 px-2 rounded-[var(--radius-md)]",
          "transition-colors duration-150",
          "hover:bg-[var(--gray-100)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)] focus-visible:ring-offset-1",
          open ? "bg-[var(--gray-100)]" : "",
        ].join(" ")}
      >
        {/* Avatar */}
        <div
          aria-hidden="true"
          className="shrink-0 h-7 w-7 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-sm)]"
          style={{ background: "var(--inlop-red)", color: "#fff" }}
        >
          {initial}
        </div>

        {/* Nombre — oculto en tablet estrecho */}
        <span
          className="hidden md:block text-[var(--text-base)] font-medium max-w-[120px] truncate"
          style={{ color: "var(--gray-700)" }}
        >
          {profile.nombre}
        </span>

        {/* Chevron */}
        <ChevronDown
          aria-hidden="true"
          className="hidden md:block w-3 h-3 shrink-0 transition-transform duration-150"
          style={{
            color:     "var(--gray-400)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Menú de ${profile.nombre}`}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 mt-2 overflow-hidden"
          style={{
            width:        "240px",
            background:   "#fff",
            borderRadius: "var(--radius-lg)",
            border:       "1px solid var(--gray-100)",
            boxShadow:    "var(--shadow-dropdown)",
            zIndex:       "var(--z-dropdown)",
            animation:    "notif-panel-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >

          {/* Encabezado — perfil del usuario */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ borderBottom: "1px solid var(--gray-100)" }}
          >
            {/* Avatar grande */}
            <div
              aria-hidden="true"
              className="shrink-0 h-10 w-10 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-lg)]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="font-semibold text-[var(--text-md)] truncate"
                style={{ color: "var(--gray-900)" }}
              >
                {profile.nombre}
              </div>

              {profile.cargo && (
                <div
                  className="flex items-center gap-1 mt-0.5 truncate text-[var(--text-xs)]"
                  style={{ color: "var(--gray-500)" }}
                >
                  <Briefcase aria-hidden="true" className="w-3 h-3 shrink-0" />
                  <span className="truncate">{profile.cargo}</span>
                </div>
              )}

              {profile.email && (
                <div
                  className="text-[var(--text-xs)] truncate mt-0.5"
                  style={{ color: "var(--gray-400)" }}
                >
                  {profile.email}
                </div>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="py-1">
            {MENU_ITEMS.map((item, idx) => {
              if (item === "separator") {
                return (
                  <div
                    key={`sep-${idx}`}
                    role="separator"
                    aria-hidden="true"
                    style={{ height: 1, background: "var(--gray-100)", margin: "4px 0" }}
                  />
                );
              }

              const disabled = !item.action;

              return (
                <button
                  key={item.id}
                  role="menuitem"
                  disabled={disabled}
                  onClick={item.action}
                  aria-disabled={disabled}
                  className={[
                    "w-full flex items-center gap-2.5 px-4 py-2 text-left text-[var(--text-md)]",
                    "transition-colors duration-100",
                    "focus-visible:outline-none focus-visible:bg-[var(--gray-50)]",
                    disabled
                      ? "cursor-default opacity-40"
                      : item.danger
                        ? "hover:bg-[var(--danger-bg)] cursor-pointer"
                        : "hover:bg-[var(--gray-50)] cursor-pointer",
                  ].join(" ")}
                  style={{
                    color: item.danger ? "var(--danger)" : "var(--gray-700)",
                  }}
                >
                  <span className="shrink-0" style={{ color: item.danger ? "var(--danger)" : "var(--gray-400)" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>

                  {/* Etiqueta "próximamente" para opciones sin acción */}
                  {disabled && !item.danger && (
                    <span
                      className="ml-auto text-[var(--text-xs)] px-1.5 py-0.5 rounded-[var(--radius-sm)] font-medium"
                      style={{ background: "var(--gray-100)", color: "var(--gray-400)" }}
                    >
                      Pronto
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
