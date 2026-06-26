import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";

// ── Interfaz pública de notificación ─────────────────────────────────────────
// Esta forma es el contrato que el backend (ControlT, Avansat, Supabase Realtime)
// deberá respetar al entregar notificaciones. No cambiar sin coordinar con backend.

export interface AppNotification {
  id:        string;
  title:     string;
  body:      string;
  read:      boolean;
  createdAt: string;   // ISO 8601
  source:    "controlt" | "avansat" | "sistema";
  href?:     string;   // Vista destino (futuro: React Router)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Notificaciones externas — en esta fase siempre [] desde AppShell */
  notifications?: AppNotification[];
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TopbarNotifications({ notifications = [] }: Props) {
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  // ── Abrir / Cerrar ──────────────────────────────────────────────────────────

  const openPanel  = () => setOpen(true);
  const closePanel = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const toggle = () => (open ? closePanel() : openPanel());

  // ── Escape cierra ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
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
      ) closePanel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* ── Trigger ────────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label={
          unread > 0
            ? `Notificaciones — ${unread} sin leer`
            : "Notificaciones — sin notificaciones nuevas"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          "relative flex items-center justify-center w-8 h-8",
          "rounded-[var(--radius-md)]",
          "transition-colors duration-150",
          "hover:bg-[var(--gray-100)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)] focus-visible:ring-offset-1",
          open ? "bg-[var(--gray-100)]" : "",
        ].join(" ")}
        style={{ color: "var(--gray-500)" }}
      >
        <Bell aria-hidden="true" className="w-4 h-4" />

        {/* Badge — visible sólo cuando unread > 0 */}
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-[var(--radius-full)] text-white font-bold"
            style={{
              background:  "var(--inlop-red)",
              fontSize:    "9px",
              lineHeight:  1,
              boxShadow:   "0 0 0 2px #fff",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Centro de notificaciones"
          className="absolute right-0 mt-2 overflow-hidden"
          style={{
            width:        "360px",
            background:   "#fff",
            borderRadius: "var(--radius-lg)",
            border:       "1px solid var(--gray-100)",
            boxShadow:    "var(--shadow-dropdown)",
            zIndex:       "var(--z-dropdown)",
            animation:    "notif-panel-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >

          {/* Header del panel */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--gray-100)" }}
          >
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="w-3.5 h-3.5" style={{ color: "var(--navy)" }} />
              <span
                className="font-semibold text-[var(--text-md)]"
                style={{ color: "var(--gray-800)" }}
              >
                Notificaciones
              </span>
              {unread > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-[var(--radius-full)] text-white font-bold text-[var(--text-xs)]"
                  style={{ background: "var(--inlop-red)" }}
                >
                  {unread}
                </span>
              )}
            </div>

            {/* Marcar todas como leídas — disponible sólo cuando hay sin leer */}
            {unread > 0 && (
              <button
                aria-label="Marcar todas como leídas"
                className="flex items-center gap-1 text-[var(--text-xs)] font-medium transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
                style={{ color: "var(--navy)" }}
                onClick={() => { /* futuro: marcar todas leídas */ }}
              >
                <CheckCheck aria-hidden="true" className="w-3 h-3" />
                Marcar leídas
              </button>
            )}
          </div>

          {/* Cuerpo del panel */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "380px" }}
            role="list"
            aria-label="Lista de notificaciones"
          >
            {notifications.length === 0 ? (
              /* Estado vacío */
              <div
                className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
                role="listitem"
                aria-label="Sin notificaciones"
              >
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-xl)]"
                  style={{ background: "var(--gray-100)" }}
                >
                  <Inbox aria-hidden="true" className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
                </div>
                <div>
                  <div
                    className="font-semibold text-[var(--text-md)] mb-0.5"
                    style={{ color: "var(--gray-700)" }}
                  >
                    No tienes notificaciones nuevas.
                  </div>
                  <div
                    className="text-[var(--text-sm)]"
                    style={{ color: "var(--gray-400)" }}
                  >
                    Las alertas de viajes, solicitudes y vehículos aparecerán aquí.
                  </div>
                </div>
              </div>
            ) : (
              /* Futuro: lista de notificaciones */
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="listitem"
                  className={[
                    "flex items-start gap-3 px-4 py-3 cursor-pointer",
                    "transition-colors duration-100",
                    "hover:bg-[var(--gray-50)]",
                    n.read ? "" : "bg-[var(--info-bg)]",
                  ].join(" ")}
                  style={{ borderBottom: "1px solid var(--gray-100)" }}
                >
                  {/* Indicador de no leído */}
                  {!n.read && (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 shrink-0 w-2 h-2 rounded-[var(--radius-full)]"
                      style={{ background: "var(--navy)" }}
                    />
                  )}
                  {n.read && <span className="mt-1.5 shrink-0 w-2 h-2" />}

                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[var(--text-md)] font-medium truncate"
                      style={{ color: "var(--gray-800)" }}
                    >
                      {n.title}
                    </div>
                    <div
                      className="text-[var(--text-sm)] truncate mt-0.5"
                      style={{ color: "var(--gray-500)" }}
                    >
                      {n.body}
                    </div>
                    <div
                      className="text-[var(--text-xs)] mt-1"
                      style={{ color: "var(--gray-400)" }}
                    >
                      {new Date(n.createdAt).toLocaleString("es-CO", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer del panel */}
          <div
            className="px-5 py-3 flex items-center justify-center"
            style={{ borderTop: "1px solid var(--gray-100)", background: "var(--gray-50)" }}
          >
            <span className="text-[var(--text-xs)]" style={{ color: "var(--gray-400)" }}>
              Las notificaciones aparecerán aquí en tiempo real.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
