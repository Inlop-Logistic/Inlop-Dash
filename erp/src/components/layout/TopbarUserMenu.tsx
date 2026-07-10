import { useState, useEffect, useRef } from "react";
import { ChevronDown, User, Settings, HelpCircle, LogOut, Briefcase } from "lucide-react";

// ── Interfaz pública del perfil de usuario ────────────────────────────────────
// Subconjunto de Profile (AuthContext) — mismos campos, todos opcionales
// excepto nombre que AuthContext garantiza no vacío.

export interface UserMenuProfile {
  nombre: string;
  cargo?: string;
  rol?:   string;   // fallback de cargo
  email?: string;
}

// ── Iniciales del avatar (dos letras: primera + última palabra) ───────────────

function getInitials(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
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
  profile:   UserMenuProfile;
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
    // Incluye items aria-disabled — el foco puede llegar a ellos pero no los activa
    const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
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
      icon:   <User       aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined,
    },
    {
      id:     "preferencias",
      label:  "Preferencias",
      icon:   <Settings   aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined,
    },
    {
      id:     "ayuda",
      label:  "Ayuda",
      icon:   <HelpCircle aria-hidden="true" className="w-3.5 h-3.5" />,
      action: undefined,
    },
    "separator",
    {
      id:     "signout",
      label:  "Cerrar sesión",
      icon:   <LogOut     aria-hidden="true" className="w-3.5 h-3.5" />,
      danger: true,
      action: () => { closeMenu(); onSignOut(); },
    },
  ];

  // Iniciales del avatar: primera + última palabra del nombre real
  const initials  = getInitials(profile.nombre);
  // Cargo visible: profiles.cargo tiene prioridad, profiles.rol como fallback
  const cargoLine = profile.cargo?.trim() || profile.rol?.trim() || null;

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
        <div
          aria-hidden="true"
          className="shrink-0 h-7 w-7 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-sm)]"
          style={{ background: "var(--inlop-red)", color: "#fff" }}
        >
          {initials}
        </div>

        <span
          className="hidden md:block text-[var(--text-base)] font-medium max-w-[120px] truncate"
          style={{ color: "var(--gray-700)" }}
        >
          {profile.nombre}
        </span>

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
            width:        "256px",
            background:   "#fff",
            borderRadius: "var(--radius-lg)",
            border:       "1px solid var(--gray-100)",
            boxShadow:    "var(--shadow-dropdown)",
            zIndex:       "var(--z-dropdown)",
            animation:    "notif-panel-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >

          {/* Encabezado */}
          <div
            className="px-5 py-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid var(--gray-100)" }}
          >
            <div
              aria-hidden="true"
              className="shrink-0 h-10 w-10 rounded-[var(--radius-full)] flex items-center justify-center font-bold text-[var(--text-lg)]"
              style={{ background: "var(--inlop-red)", color: "#fff" }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="font-semibold text-[var(--text-md)] truncate"
                style={{ color: "var(--gray-900)" }}
              >
                {profile.nombre}
              </div>

              {cargoLine && (
                <div
                  className="flex items-center gap-1 mt-0.5 text-[var(--text-xs)]"
                  style={{ color: "var(--gray-500)" }}
                >
                  <Briefcase aria-hidden="true" className="w-3 h-3 shrink-0" />
                  <span className="truncate">{cargoLine}</span>
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
          <div className="py-1.5">
            {MENU_ITEMS.map((item, idx) => {
              if (item === "separator") {
                return (
                  <div
                    key={`sep-${idx}`}
                    role="separator"
                    aria-hidden="true"
                    style={{ height: 1, background: "var(--gray-100)", margin: "6px 0" }}
                  />
                );
              }

              // Opciones sin action: aria-disabled sin disabled HTML para que
              // reciban hover y muestren el tooltip nativo del title.
              const upcoming = !item.action && !item.danger;

              return (
                <button
                  key={item.id}
                  role="menuitem"
                  aria-disabled={upcoming || undefined}
                  title={upcoming ? "Disponible próximamente" : undefined}
                  onClick={item.action ?? undefined}
                  className={[
                    "w-full flex items-center gap-3 px-5 py-2.5 text-left text-[var(--text-md)]",
                    "transition-colors duration-150",
                    "focus-visible:outline-none",
                    upcoming
                      ? "cursor-default"
                      : item.danger
                        ? "hover:bg-[var(--danger-bg)] cursor-pointer focus-visible:bg-[var(--danger-bg)]"
                        : "hover:bg-[var(--gray-50)] cursor-pointer focus-visible:bg-[var(--gray-50)]",
                  ].join(" ")}
                  style={{
                    color: upcoming
                      ? "var(--gray-300)"
                      : item.danger
                        ? "var(--danger)"
                        : "var(--gray-700)",
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{
                      color: upcoming
                        ? "var(--gray-300)"
                        : item.danger
                          ? "var(--danger)"
                          : "var(--gray-400)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
