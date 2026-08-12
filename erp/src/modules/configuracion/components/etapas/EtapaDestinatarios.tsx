/**
 * Etapa 05 — Destinatarios
 *
 * Dos fuentes de destinatarios, persistidas por separado (nunca como una
 * cadena de correos concatenada):
 *   - Personal INLOP: seleccionado por checkbox desde `personal`, el
 *     maestro real de personal de INLOP (ver GET /api/personal → index.js;
 *     fuente SQL_04_personal.sql). NO es `profiles`, NO es `usuarios_cliente`,
 *     NO es una lista hardcodeada ni una tabla nueva.
 *   - Correos externos: agregados manualmente, con validación de formato.
 *
 * Se persisten referencias (personal.id), no snapshots de nombre/correo —
 * si el dato de una persona cambia en `personal`, el reporte sigue
 * apuntando a la persona correcta. El correo de Personal INLOP viene de
 * personal.correo_compartido, que puede repetirse entre varias personas de
 * una misma área (dato real de la fuente, no un error de deduplicación).
 *
 * Layout de dos columnas (ajuste UX):
 *   Izquierda → fuente completa de Personal INLOP (buscador + lista con
 *     scroll interno propio, es la única lista que puede crecer mucho).
 *   Derecha   → destinatarios ya elegidos: Personal INLOP seleccionado y
 *     correos externos, separados visualmente, con la sección para agregar
 *     correos externos. Se actualiza de inmediato al marcar/desmarcar a la
 *     izquierda — mismo estado controlado, sin paso intermedio.
 * Ambas columnas comparten presupuesto de altura fijo — nada de "Resumen"
 * aparte empujando la página hacia abajo.
 *
 * Componente controlado: la selección vive en ConfiguradorReporte. El único
 * estado local es el propio de esta etapa (personal cargado, búsqueda,
 * input de correo nuevo) — no la selección en sí.
 */
import { useEffect, useState } from "react";
import { Search, Plus, X, Mail, Users } from "lucide-react";
import { Button }                       from "@/components/ui";
import { listarPersonal }               from "../../services/api";
import type { PersonalInlop, DestinatariosReporte } from "../../types";

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
  fontSize:     "11px",
  fontWeight:   700,
  color:        "var(--gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  display:      "block",
  marginBottom: "8px",
};

const PANEL_MAX_HEIGHT = "420px";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  destinatarios: DestinatariosReporte;
  onChange:      (d: DestinatariosReporte) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EtapaDestinatarios({ destinatarios, onChange }: Props) {
  const [personal,  setPersonal]  = useState<PersonalInlop[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [busqueda,  setBusqueda]  = useState("");
  const [nuevoCorreo,  setNuevoCorreo]  = useState("");
  const [errorCorreo,  setErrorCorreo]  = useState<string | null>(null);

  function cargarPersonal() {
    setCargando(true);
    setError(null);
    listarPersonal()
      .then(setPersonal)
      .catch(e => setError(e instanceof Error ? e.message : "No se pudo cargar el Personal INLOP"))
      .finally(() => setCargando(false));
  }

  useEffect(cargarPersonal, []);

  // ── Personal INLOP ────────────────────────────────────────────────────────

  const personalSeleccionado = new Set(destinatarios.personal_ids);

  const personalFiltrado = busqueda.trim()
    ? personal.filter(p => {
        const q = busqueda.trim().toLowerCase();
        return p.nombre.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      })
    : personal;

  function togglePersonal(id: string) {
    const next = personalSeleccionado.has(id)
      ? destinatarios.personal_ids.filter(pid => pid !== id)
      : [...destinatarios.personal_ids, id];
    onChange({ ...destinatarios, personal_ids: next });
  }

  // ── Correos externos ──────────────────────────────────────────────────────

  const emailsPersonal = new Set(personal.map(p => p.email.toLowerCase()));

  function agregarCorreo() {
    const email = nuevoCorreo.trim();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setErrorCorreo("Formato de correo inválido.");
      return;
    }
    const clave = email.toLowerCase();
    if (destinatarios.correos_externos.some(c => c.toLowerCase() === clave)) {
      setErrorCorreo("Ese correo ya está en la lista.");
      return;
    }
    if (emailsPersonal.has(clave)) {
      setErrorCorreo("Ese correo ya pertenece a una persona del Personal INLOP — selecciónala a la izquierda en vez de agregarla como externa.");
      return;
    }
    onChange({ ...destinatarios, correos_externos: [...destinatarios.correos_externos, email] });
    setNuevoCorreo("");
    setErrorCorreo(null);
  }

  function eliminarCorreo(email: string) {
    onChange({
      ...destinatarios,
      correos_externos: destinatarios.correos_externos.filter(c => c !== email),
    });
  }

  // ── Destinatarios elegidos (columna derecha) ──────────────────────────────

  const personalElegido = personal.filter(p => personalSeleccionado.has(p.id));
  const totalDestinatarios = personalElegido.length + destinatarios.correos_externos.length;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0" style={{ maxWidth: "860px" }}>

      <div className="shrink-0">
        <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
          Destinatarios del reporte
        </p>
        <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
          Elige quién recibe el reporte: Personal INLOP y/o correos externos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 min-h-0" style={{ flex: "1 1 auto" }}>

        {/* ── Columna izquierda: fuente — Personal INLOP ── */}
        <div className="flex flex-col min-w-0">
          <label style={LABEL_STYLE}>
            Personal INLOP
            {personalSeleccionado.size > 0 && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--gray-400)" }}>
                {" "}· {personalSeleccionado.size} seleccionado{personalSeleccionado.size !== 1 ? "s" : ""}
              </span>
            )}
          </label>

          <div className="relative mb-2 shrink-0">
            <Search
              className="absolute pointer-events-none"
              style={{ width: "14px", height: "14px", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }}
            />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              style={{ ...INPUT_STYLE, width: "100%", paddingLeft: "30px" }}
            />
          </div>

          <div
            className="flex flex-col gap-1 overflow-y-auto rounded-xl p-1.5"
            style={{ maxHeight: PANEL_MAX_HEIGHT, border: "1.5px solid var(--gray-200)", background: "var(--gray-50)" }}
          >
            {cargando ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <span
                  className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--gray-300)", borderTopColor: "transparent" }}
                />
                <span className="text-[13px]" style={{ color: "var(--gray-400)" }}>Cargando Personal INLOP…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>{error}</p>
                <Button variant="outline" size="sm" onClick={cargarPersonal}>Reintentar</Button>
              </div>
            ) : personalFiltrado.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6">
                <Users style={{ width: "20px", height: "20px", color: "var(--gray-300)" }} />
                <p className="text-[12.5px]" style={{ color: "var(--gray-400)" }}>
                  {personal.length === 0 ? "No hay Personal INLOP registrado" : "No se encontraron coincidencias"}
                </p>
              </div>
            ) : (
              personalFiltrado.map(p => {
                const activo = personalSeleccionado.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ background: activo ? "#fff" : "transparent", border: `1.5px solid ${activo ? "var(--gray-200)" : "transparent"}` }}
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 flex items-center justify-center rounded"
                      style={{
                        width: "18px", height: "18px",
                        border: `2px solid ${activo ? "var(--navy)" : "var(--gray-300)"}`,
                        background: activo ? "var(--navy)" : "transparent",
                        color: "#fff",
                      }}
                    >
                      {activo && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => togglePersonal(p.id)}
                      className="sr-only"
                      aria-label={`Seleccionar a ${p.nombre}`}
                    />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--gray-800)" }}>
                        {p.nombre || p.email}
                      </span>
                      <span className="text-[11.5px] truncate" style={{ color: "var(--gray-400)" }}>
                        {p.email}{p.cargo ? ` · ${p.cargo}` : ""}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ── Columna derecha: destinatarios elegidos ── */}
        <div className="flex flex-col min-w-0">
          <label style={LABEL_STYLE}>
            Destinatarios seleccionados
            {totalDestinatarios > 0 && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--gray-400)" }}>
                {" "}· {totalDestinatarios}
              </span>
            )}
          </label>

          {/* Agregar correo externo — siempre visible, no vive dentro del scroll */}
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <input
              type="email"
              value={nuevoCorreo}
              onChange={e => { setNuevoCorreo(e.target.value); if (errorCorreo) setErrorCorreo(null); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarCorreo(); } }}
              placeholder="Agregar correo externo…"
              style={{ ...INPUT_STYLE, flex: 1 }}
            />
            <Button variant="outline" size="sm" onClick={agregarCorreo} icon={<Plus className="w-3.5 h-3.5" />}>
              Agregar
            </Button>
          </div>
          {errorCorreo && (
            <p className="text-[11.5px] mb-2 shrink-0" style={{ color: "var(--inlop-red)" }}>{errorCorreo}</p>
          )}

          {/* Lista combinada, separada visualmente — única zona con scroll de esta columna */}
          <div
            className="flex flex-col gap-3 overflow-y-auto rounded-xl p-2.5"
            style={{
              maxHeight:  PANEL_MAX_HEIGHT,
              border:     `1.5px solid ${totalDestinatarios === 0 ? "var(--danger-light)" : "var(--gray-200)"}`,
              background: totalDestinatarios === 0 ? "var(--danger-bg)" : "var(--gray-50)",
            }}
          >
            {/* Personal INLOP seleccionado */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--gray-400)" }}>
                Personal INLOP · {personalElegido.length}
              </p>
              {personalElegido.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--gray-400)" }}>Ninguno seleccionado</p>
              ) : (
                personalElegido.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                    style={{ border: "1.5px solid var(--gray-200)", background: "#fff" }}
                  >
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: "rgba(1, 42, 107, 0.08)", color: "var(--navy)" }}
                    >
                      INLOP
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--gray-800)" }}>
                        {p.nombre || p.email}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: "var(--gray-400)" }}>{p.email}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar a ${p.nombre}`}
                      onClick={() => togglePersonal(p.id)}
                      className="shrink-0 flex items-center justify-center rounded-md"
                      style={{ width: "22px", height: "22px", color: "var(--gray-400)", cursor: "pointer" }}
                    >
                      <X style={{ width: "13px", height: "13px" }} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: "1.5px solid var(--gray-200)" }} />

            {/* Correos externos */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--gray-400)" }}>
                Correos externos · {destinatarios.correos_externos.length}
              </p>
              {destinatarios.correos_externos.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--gray-400)" }}>Ninguno agregado</p>
              ) : (
                destinatarios.correos_externos.map(email => (
                  <div
                    key={email}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                    style={{ border: "1.5px solid var(--gray-200)", background: "#fff" }}
                  >
                    <Mail className="shrink-0" style={{ width: "13px", height: "13px", color: "var(--gray-400)" }} />
                    <span className="flex-1 text-[12.5px] truncate" style={{ color: "var(--gray-700)" }}>{email}</span>
                    <button
                      type="button"
                      aria-label={`Eliminar correo ${email}`}
                      onClick={() => eliminarCorreo(email)}
                      className="shrink-0 flex items-center justify-center rounded-md"
                      style={{ width: "22px", height: "22px", color: "var(--gray-400)", cursor: "pointer" }}
                    >
                      <X style={{ width: "13px", height: "13px" }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {totalDestinatarios === 0 && (
            <p className="text-[11.5px] mt-2 shrink-0" style={{ color: "var(--inlop-red)" }}>
              Selecciona al menos un destinatario (Personal INLOP o correo externo) para continuar.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
