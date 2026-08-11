/**
 * ConfiguradorReporte — Wizard multi-etapa para crear reportes automáticos.
 *
 * Estructura:
 *   - Sidebar izquierdo con las 6 etapas y su estado visual (✓ / ● / ○)
 *   - Área de contenido derecha que monta la etapa activa
 *   - Footer con acciones: Cancelar | Guardar borrador | Continuar
 *                          (última etapa: ← Atrás | Activar reporte)
 *
 * Para agregar una etapa nueva:
 *   1. Crear el componente en ./etapas/EtapaXxx.tsx
 *   2. Agregar su slice a DatosConfigurador en types.ts
 *   3. Añadir el case en renderContenido()
 *   4. Implementar isEtapaCompleta() para esa etapa
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";
import {
  ETAPAS,
  DATOS_INFO_BASICA_INICIAL,
  etapaInfoBasicaCompleta,
  etapaFrecuenciaCompleta,
  crearRecurrenciaInicial,
  etapaDestinatariosCompleta,
  crearDestinatariosInicial,
  type EtapaId,
  type EtapaConfig,
  type DatosConfigurador,
} from "../types";
import { buscarReporte }                                       from "../catalogos/datasetsReportes";
import { crearReporteAutomatico, actualizarReporteAutomatico } from "../services/api";
import { EtapaInfoBasica }     from "./etapas/EtapaInfoBasica";
import { EtapaFiltros }        from "./etapas/EtapaFiltros";
import { EtapaColumnas }       from "./etapas/EtapaColumnas";
import { EtapaFrecuencia }     from "./etapas/EtapaFrecuencia";
import { EtapaDestinatarios }  from "./etapas/EtapaDestinatarios";
import { EtapaPlaceholder }    from "./etapas/EtapaPlaceholder";
import { EtapaRevision }       from "./etapas/EtapaRevision";

// ─── Descripciones de las etapas placeholder ────────────────────────────────

const PLACEHOLDER_DESC: Partial<Record<EtapaId, string>> = {
  filtros:  "Define criterios para filtrar qué registros se incluyen en el reporte.",
  columnas: "Elige qué columnas aparecerán en el reporte y en qué orden.",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEtapaCompleta(id: EtapaId, datos: DatosConfigurador): boolean {
  if (id === "info-basica") return etapaInfoBasicaCompleta(datos.infoBasica);
  // "filtros" siempre es válida — array vacío = sin filtros (incluir todos)
  if (id === "filtros") return true;
  // "columnas" es válida si hay al menos una columna seleccionada, o si aún
  // no se ha tocado ([] = todas por defecto)
  if (id === "columnas") return true;
  if (id === "frecuencia")    return etapaFrecuenciaCompleta(datos.frecuencia);
  if (id === "destinatarios") return etapaDestinatariosCompleta(datos.destinatarios);
  return false;
}

function datosInicial(): DatosConfigurador {
  return {
    infoBasica:    { ...DATOS_INFO_BASICA_INICIAL },
    filtros:       [],
    columnas:      [],
    frecuencia:    crearRecurrenciaInicial(),
    destinatarios: crearDestinatariosInicial(),
  };
}

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  onCreado:   () => void;
  onCancelar: () => void;
}

export function ConfiguradorReporte({ onCreado, onCancelar }: Props) {
  const [etapaActiva, setEtapaActiva] = useState<EtapaId>("info-basica");
  const [datos,       setDatos]       = useState<DatosConfigurador>(datosInicial);
  const [borradorId,  setBorradorId]  = useState<string | null>(null);
  const [guardando,   setGuardando]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const etapaIndex     = ETAPAS.findIndex(e => e.id === etapaActiva);
  const esUltimaEtapa  = etapaIndex === ETAPAS.length - 1;
  const esPrimeraEtapa = etapaIndex === 0;

  // ── Navegación ────────────────────────────────────────────────────────────

  function irA(id: EtapaId) {
    setErrorMsg(null);
    setEtapaActiva(id);
  }

  function handleContinuar() {
    // Destinatarios exige al menos un destinatario para poder avanzar.
    if (etapaActiva === "destinatarios" && !etapaDestinatariosCompleta(datos.destinatarios)) {
      setErrorMsg("Selecciona al menos un destinatario (Personal INLOP o correo externo) para continuar.");
      return;
    }
    if (!esUltimaEtapa) irA(ETAPAS[etapaIndex + 1].id);
  }

  function handleAtras() {
    if (!esPrimeraEtapa) irA(ETAPAS[etapaIndex - 1].id);
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

  async function guardarBorrador() {
    if (!datos.infoBasica.nombre.trim()) {
      setErrorMsg("El nombre es obligatorio para guardar un borrador.");
      return;
    }
    setErrorMsg(null);
    setGuardando(true);
    try {
      // Serializar filtros: strip `id` (local React key) antes de enviar a la DB
      const filtrosDB = datos.filtros.map(({ id: _id, ...rest }) => rest);
      const payload = {
        ...datos.infoBasica,
        cuerpo:        datos.infoBasica.cuerpo.trim() || null,
        borrador:      true,
        activo:        false,
        frecuencia:    datos.frecuencia.tipo,
        filtros:       filtrosDB,
        columnas:      datos.columnas,
        recurrencia:   datos.frecuencia,
        destinatarios: datos.destinatarios,
      };
      if (borradorId) {
        await actualizarReporteAutomatico(borradorId, payload);
      } else {
        const nuevo = await crearReporteAutomatico(payload);
        setBorradorId(nuevo.id);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al guardar borrador");
    } finally {
      setGuardando(false);
    }
  }

  async function activarReporte() {
    if (!etapaInfoBasicaCompleta(datos.infoBasica)) {
      setErrorMsg("Completa el Nombre y el Asunto del correo antes de activar.");
      return;
    }
    if (!etapaFrecuenciaCompleta(datos.frecuencia)) {
      setErrorMsg("Completa los campos requeridos de Frecuencia antes de activar.");
      return;
    }
    if (!etapaDestinatariosCompleta(datos.destinatarios)) {
      setErrorMsg("Selecciona al menos un destinatario (Personal INLOP o correo externo) antes de activar.");
      return;
    }
    setErrorMsg(null);
    setGuardando(true);
    try {
      // Serializar filtros: strip `id` (local React key) antes de enviar a la DB
      const filtrosDB = datos.filtros.map(({ id: _id, ...rest }) => rest);
      const payload = {
        ...datos.infoBasica,
        cuerpo:        datos.infoBasica.cuerpo.trim() || null,
        borrador:      false,
        activo:        datos.infoBasica.activo,
        frecuencia:    datos.frecuencia.tipo,
        filtros:       filtrosDB,
        columnas:      datos.columnas,
        recurrencia:   datos.frecuencia,
        destinatarios: datos.destinatarios,
      };
      if (borradorId) {
        await actualizarReporteAutomatico(borradorId, payload);
      } else {
        await crearReporteAutomatico(payload);
      }
      onCreado();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al activar el reporte");
    } finally {
      setGuardando(false);
    }
  }

  // ── Contenido de la etapa activa ──────────────────────────────────────────

  function renderContenido() {
    switch (etapaActiva) {
      case "info-basica":
        return (
          <EtapaInfoBasica
            datos={datos.infoBasica}
            onChange={infoBasica => setDatos(d => {
              // Al cambiar tipo_reporte, descartar columnas y filtros que ya no
              // pertenecen al nuevo reporte para evitar claves huérfanas en el
              // borrador (y en la Vista previa de Revisión).
              if (infoBasica.tipo_reporte !== d.infoBasica.tipo_reporte) {
                const nuevoReporte = buscarReporte(infoBasica.tipo_reporte);
                const keysColumna  = new Set(
                  nuevoReporte?.campos.filter(c => c.seleccionableColumna).map(c => c.key) ?? []
                );
                const keysFiltro = new Set(
                  nuevoReporte?.campos.filter(c => c.filtrable).map(c => c.key) ?? []
                );
                return {
                  ...d,
                  infoBasica,
                  columnas: d.columnas
                    .filter(c => keysColumna.has(c.campo))
                    .map((c, i) => ({ ...c, orden: i })),
                  filtros: d.filtros.filter(f => keysFiltro.has(f.campo)),
                };
              }
              return { ...d, infoBasica };
            })}
          />
        );
      case "filtros":
        return (
          <EtapaFiltros
            filtros={datos.filtros}
            tipoReporte={datos.infoBasica.tipo_reporte}
            onChange={filtros => setDatos(d => ({ ...d, filtros }))}
          />
        );
      case "columnas":
        return (
          // key={tipo_reporte} garantiza un remount limpio cuando cambia el reporte
          <EtapaColumnas
            key={datos.infoBasica.tipo_reporte}
            columnas={datos.columnas}
            tipoReporte={datos.infoBasica.tipo_reporte}
            onChange={columnas => setDatos(d => ({ ...d, columnas }))}
          />
        );
      case "frecuencia":
        return (
          <EtapaFrecuencia
            recurrencia={datos.frecuencia}
            onChange={frecuencia => setDatos(d => ({ ...d, frecuencia }))}
          />
        );
      case "destinatarios":
        return (
          <EtapaDestinatarios
            destinatarios={datos.destinatarios}
            onChange={destinatarios => setDatos(d => ({ ...d, destinatarios }))}
          />
        );
      case "revision":
        return <EtapaRevision datos={datos} onIrA={irA} />;
      default: {
        const etapa = ETAPAS.find(e => e.id === etapaActiva)!;
        return (
          <EtapaPlaceholder
            numero={etapa.numero}
            titulo={etapa.label}
            descripcion={PLACEHOLDER_DESC[etapa.id] ?? ""}
          />
        );
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{
        border:       "1.5px solid var(--gray-200)",
        borderRadius: "var(--radius-lg)",
        minHeight:    "480px",
      }}
    >
      {/* ── Área principal: sidebar + contenido ───────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Sidebar */}
        <nav
          aria-label="Etapas del configurador"
          className="flex flex-col py-2 shrink-0"
          style={{
            width:       "210px",
            borderRight: "1.5px solid var(--gray-200)",
            background:  "var(--gray-50)",
          }}
        >
          {ETAPAS.map(etapa => (
            <SidebarItem
              key={etapa.id}
              etapa={etapa}
              activa={etapa.id === etapaActiva}
              completa={isEtapaCompleta(etapa.id, datos)}
              onClick={() => irA(etapa.id)}
            />
          ))}
        </nav>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContenido()}
        </div>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        className="shrink-0 flex items-center gap-3 px-5"
        style={{
          borderTop:  "1.5px solid var(--gray-200)",
          background: "var(--gray-50)",
          minHeight:  "60px",
        }}
      >
        {/* Cancelar — izquierda */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Button>

        {/* Error inline */}
        {errorMsg && (
          <p
            className="text-[12px]"
            style={{ color: "var(--inlop-red)", flex: "1 1 0" }}
          >
            {errorMsg}
          </p>
        )}

        <div style={{ flex: "1 1 0" }} />

        {/* Acciones — derecha */}
        {esUltimaEtapa ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAtras}
              disabled={guardando}
            >
              ← Atrás
            </Button>
            <Button
              size="sm"
              onClick={activarReporte}
              loading={guardando}
            >
              Activar reporte
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={guardarBorrador}
              loading={guardando}
            >
              Guardar borrador
            </Button>
            <Button
              size="sm"
              onClick={handleContinuar}
              disabled={guardando}
            >
              Continuar
            </Button>
          </>
        )}
      </footer>

    </div>
  );
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

function SidebarItem({
  etapa,
  activa,
  completa,
  onClick,
}: {
  etapa:    EtapaConfig;
  activa:   boolean;
  completa: boolean;
  onClick:  () => void;
}) {
  const indicatorBg = completa
    ? "var(--success)"
    : activa
    ? "var(--navy)"
    : "transparent";

  const indicatorBorder = completa || activa
    ? "none"
    : "1.5px solid var(--gray-300)";

  const indicatorColor = completa || activa ? "#fff" : "var(--gray-400)";

  const labelColor = activa
    ? "var(--navy)"
    : completa
    ? "var(--gray-600)"
    : "var(--gray-500)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 transition-colors"
      style={{
        background:  activa ? "rgba(1, 42, 107, 0.06)" : "transparent",
        borderLeft:  activa ? "2.5px solid var(--navy)" : "2.5px solid transparent",
        cursor:      "pointer",
      }}
    >
      {/* Indicador numérico / check */}
      <span
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{
          width:        "20px",
          height:       "20px",
          fontSize:     "10px",
          fontWeight:   700,
          background:   indicatorBg,
          border:       indicatorBorder,
          color:        indicatorColor,
          lineHeight:   1,
        }}
      >
        {completa
          ? <Check style={{ width: "10px", height: "10px", strokeWidth: 3 }} />
          : etapa.numero
        }
      </span>

      {/* Label */}
      <span
        className="text-[12.5px] font-medium leading-tight"
        style={{ color: labelColor }}
      >
        {etapa.label}
      </span>
    </button>
  );
}
