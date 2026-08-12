/**
 * SelectorClientes — Control de valor para el filtro "Cliente" (Fase 11A,
 * tipoValor "multiselect"). A diferencia del resto de controles de
 * FiltroRow, sus opciones no vienen del catálogo estático (no son fijas
 * como Estado o Línea de negocio) — se cargan en vivo desde
 * GET /api/reportes-automaticos/clientes, el mismo dataset y la misma
 * normalización que aplica el Filter Engine real (ver
 * services/reportes/datasetProvider.js#listarClientesDataset).
 *
 * "Todos" es el estado por defecto: `valores` vacío o ausente. Elegir uno o
 * varios clientes activa la restricción (condición OR entre los elegidos —
 * ver evaluaCondicion en services/api.ts y filterEngine.js).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { listarClientesReporte } from "../../../services/api";
import type { ClienteFiltroOpcion } from "../../../types";

// ─── Caché en memoria por tipoReporte ────────────────────────────────────────
// Evita volver a pedir la lista cada vez que se monta este control (ej. al
// agregar un segundo filtro) o si el usuario abre/cierra el popover varias
// veces. Vive mientras dure la sesión de la pestaña — sin invalidación
// explícita, igual de razonable que otros catálogos cargados una vez por
// sesión en el wizard (ej. listarPersonal en EtapaDestinatarios).
const cacheClientes = new Map<string, Promise<ClienteFiltroOpcion[]>>();

function cargarClientes(tipoReporte: string): Promise<ClienteFiltroOpcion[]> {
  if (!cacheClientes.has(tipoReporte)) {
    const promesa = listarClientesReporte(tipoReporte).catch(e => {
      cacheClientes.delete(tipoReporte); // permite reintentar en el próximo montaje
      throw e;
    });
    cacheClientes.set(tipoReporte, promesa);
  }
  return cacheClientes.get(tipoReporte)!;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CONTROL_STYLE: React.CSSProperties = {
  border:       "1.5px solid var(--gray-200)",
  borderRadius: "var(--radius-lg)",
  color:        "var(--gray-700)",
  background:   "#fff",
  fontSize:     "13px",
  padding:      "7px 10px",
  outline:      "none",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  tipoReporte: string;
  valores:     string[];
  onChange:    (valores: string[]) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SelectorClientes({ tipoReporte, valores, onChange }: Props) {
  const [opciones, setOpciones] = useState<ClienteFiltroOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [abierto,  setAbierto]  = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    cargarClientes(tipoReporte)
      .then(o => { if (vivo) setOpciones(o); })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : "No se pudieron cargar los clientes"); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [tipoReporte]);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  const seleccionados = new Set(valores);
  const busquedaNorm = busqueda.trim().toLowerCase();
  const filtradas = busquedaNorm
    ? opciones.filter(o => o.label.toLowerCase().includes(busquedaNorm))
    : opciones;

  function toggle(value: string) {
    onChange(seleccionados.has(value) ? valores.filter(v => v !== value) : [...valores, value]);
  }

  const resumen =
    valores.length === 0 ? "Todos"
    : valores.length === 1 ? (opciones.find(o => o.value === valores[0])?.label ?? "1 seleccionado")
    : `${valores.length} clientes seleccionados`;

  return (
    <div className="relative" ref={contenedorRef} style={{ minWidth: "220px" }}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        style={{ ...CONTROL_STYLE, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", cursor: "pointer" }}
        aria-label="Seleccionar clientes"
        aria-expanded={abierto}
      >
        <span className="truncate" style={{ textAlign: "left" }}>{resumen}</span>
        <ChevronDown style={{ width: "14px", height: "14px", flexShrink: 0, color: "var(--gray-400)" }} />
      </button>

      {abierto && (
        <div
          className="absolute z-10 mt-1 flex flex-col rounded-xl overflow-hidden"
          style={{ width: "280px", background: "#fff", border: "1.5px solid var(--gray-200)", boxShadow: "0 8px 24px rgba(1,42,107,0.14)" }}
        >
          <div className="relative p-2 shrink-0" style={{ borderBottom: "1.5px solid var(--gray-100)" }}>
            <Search
              className="absolute pointer-events-none"
              style={{ width: "13px", height: "13px", left: "18px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }}
            />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              style={{ ...CONTROL_STYLE, width: "100%", paddingLeft: "26px" }}
              autoFocus
            />
          </div>

          <div className="flex flex-col overflow-y-auto p-1.5" style={{ maxHeight: "230px" }}>
            <label
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
              style={{ background: valores.length === 0 ? "var(--gray-50)" : "transparent" }}
            >
              <input type="radio" checked={valores.length === 0} onChange={() => onChange([])} className="sr-only" />
              <Casilla activo={valores.length === 0} />
              <span className="text-[12.5px] font-medium" style={{ color: "var(--gray-700)" }}>Todos</span>
            </label>

            {cargando ? (
              <p className="text-[12px] px-2 py-3" style={{ color: "var(--gray-400)" }}>Cargando clientes…</p>
            ) : error ? (
              <p className="text-[12px] px-2 py-3" style={{ color: "var(--inlop-red)" }}>{error}</p>
            ) : filtradas.length === 0 ? (
              <p className="text-[12px] px-2 py-3" style={{ color: "var(--gray-400)" }}>
                {opciones.length === 0 ? "Sin clientes disponibles" : "Sin coincidencias"}
              </p>
            ) : (
              filtradas.map(o => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                  style={{ background: seleccionados.has(o.value) ? "var(--gray-50)" : "transparent" }}
                >
                  <input type="checkbox" checked={seleccionados.has(o.value)} onChange={() => toggle(o.value)} className="sr-only" />
                  <Casilla activo={seleccionados.has(o.value)} />
                  <span className="text-[12.5px] truncate" style={{ color: "var(--gray-700)" }}>{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Casilla({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 flex items-center justify-center rounded"
      style={{
        width: "16px", height: "16px",
        border: `2px solid ${activo ? "var(--navy)" : "var(--gray-300)"}`,
        background: activo ? "var(--navy)" : "transparent",
        color: "#fff",
      }}
    >
      {activo && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
