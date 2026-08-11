/**
 * Etapa 07 — Revisión y activación
 *
 * Muestra un resumen de toda la configuración. La activación real
 * la ejecuta ConfiguradorReporte (botón "Activar reporte" en el footer).
 *
 * Al desarrollar las etapas 03-06, agregar cada sección de resumen aquí.
 */
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  ETAPAS,
  labelModulo, labelTipoReporte, labelFormato,
  etapaInfoBasicaCompleta,
  type DatosConfigurador,
} from "../../types";
import { CAMPOS_FILTRO }  from "./filtros/catalogoFiltros";
import { buscarReporte }  from "../../catalogos/datasetsReportes";

interface Props {
  datos: DatosConfigurador;
}

export function EtapaRevision({ datos }: Props) {
  const ib = datos.infoBasica;
  const infoCompleta = etapaInfoBasicaCompleta(ib);

  const camposFiltro = CAMPOS_FILTRO[ib.tipo_reporte] ?? [];

  // Columnas: resolución de labels desde el catálogo central
  const camposColumna = buscarReporte(ib.tipo_reporte)
    ?.campos.filter(c => c.seleccionableColumna) ?? [];
  const camposColumnaMap = new Map(camposColumna.map(c => [c.key, c]));
  // Si no hay selección explícita, mostrar "todas por defecto"
  const columnasEfectivas = datos.columnas.length > 0
    ? datos.columnas.filter(k => camposColumnaMap.has(k))
    : camposColumna.map(c => c.key);

  // Etapas intermedias (04-06): pendientes de implementar
  const etapasPendientes = ETAPAS.filter(
    e => !["info-basica", "filtros", "columnas", "revision"].includes(e.id)
  );

  return (
    <div className="flex flex-col gap-5 max-w-lg">

      <div>
        <p className="font-semibold text-[15px]" style={{ color: "var(--navy)" }}>
          Revisión del reporte
        </p>
        <p className="text-[13px] mt-1" style={{ color: "var(--gray-400)" }}>
          Verifica la configuración antes de activar el reporte.
        </p>
      </div>

      {/* ─── Etapa 01: Información básica ─── */}
      <section
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ border: `1.5px solid ${infoCompleta ? "var(--gray-200)" : "var(--danger-light)"}`, background: infoCompleta ? "var(--gray-50)" : "var(--danger-bg)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: infoCompleta ? "var(--gray-500)" : "var(--inlop-red)" }}
          >
            01 · Información básica
          </span>
          {infoCompleta
            ? <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
            : <AlertCircle  className="w-4 h-4" style={{ color: "var(--inlop-red)" }} />
          }
        </div>

        {infoCompleta ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {([
              ["Nombre",   ib.nombre],
              ["Módulo",   labelModulo(ib.modulo_id)],
              ["Reporte",  labelTipoReporte(ib.tipo_reporte)],
              ["Asunto",   ib.asunto],
              ["Formato",  labelFormato(ib.formato)],
              ["Estado",   ib.activo ? "Activo al publicar" : "Inactivo al publicar"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>
                  {label}
                </dt>
                <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
                  {value || "—"}
                </dd>
              </div>
            ))}
            {ib.cuerpo && (
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Cuerpo</dt>
                <dd className="text-[13px] mt-0.5 whitespace-pre-wrap" style={{ color: "var(--gray-700)" }}>
                  {ib.cuerpo}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>
            Información incompleta — vuelve a la etapa 01 y completa el <strong>Nombre</strong> y el <strong>Asunto del correo</strong>.
          </p>
        )}
      </section>

      {/* ─── Etapa 02: Filtros ─── */}
      <section
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ border: "1.5px solid var(--gray-200)", background: "var(--gray-50)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--gray-500)" }}
          >
            02 · Filtros
          </span>
          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
        </div>

        {datos.filtros.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
            Sin filtros — se incluirán todos los registros.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {datos.filtros.map((f, i) => {
              const campoCfg    = camposFiltro.find(c => c.campo === f.campo);
              const operadorCfg = campoCfg?.operadores.find(o => o.id === f.operador);
              const campoLabel    = campoCfg?.label    ?? f.campo;
              const operadorLabel = operadorCfg?.label ?? f.operador;

              let valorLabel = "";
              if (f.campo && f.operador) {
                if (operadorCfg?.tipoValor === "ninguno") {
                  valorLabel = "";
                } else if (operadorCfg?.tipoValor === "date_range") {
                  valorLabel = `${f.valor_desde ?? "—"} y ${f.valor_hasta ?? "—"}`;
                } else if (operadorCfg?.tipoValor === "select") {
                  const opcion = campoCfg?.opciones?.find(o => o.value === f.valor);
                  valorLabel = opcion?.label ?? f.valor ?? "—";
                } else {
                  valorLabel = f.valor ?? "—";
                }
              }

              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 flex-wrap"
                  style={{ fontSize: "13px", color: "var(--gray-700)" }}
                >
                  <span style={{ fontWeight: 600 }}>{campoLabel}</span>
                  <span style={{ color: "var(--gray-400)" }}>{operadorLabel}</span>
                  {valorLabel && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[12px] font-medium"
                      style={{ background: "var(--gray-200)", color: "var(--gray-700)" }}
                    >
                      {valorLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Etapa 03: Columnas ─── */}
      <section
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ border: "1.5px solid var(--gray-200)", background: "var(--gray-50)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--gray-500)" }}
          >
            03 · Columnas
          </span>
          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
        </div>

        {datos.columnas.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--gray-500)" }}>
            Todas las columnas disponibles · {camposColumna.length} columnas en orden del catálogo.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {columnasEfectivas.map((key, idx) => {
              const campo = camposColumnaMap.get(key);
              return (
                <div
                  key={key}
                  className="flex items-center gap-2"
                  style={{ fontSize: "13px", color: "var(--gray-700)" }}
                >
                  <span
                    className="text-[10.5px] font-semibold tabular-nums"
                    style={{ color: "var(--gray-400)", minWidth: "18px" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontWeight: 500 }}>{campo?.label ?? key}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Etapas 04-06: pendientes ─── */}
      {etapasPendientes.map(etapa => (
        <section
          key={etapa.id}
          className="rounded-xl p-4"
          style={{ border: "1.5px dashed var(--gray-200)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--gray-400)" }}
            >
              {String(etapa.numero).padStart(2, "0")} · {etapa.label}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--gray-100)", color: "var(--gray-400)" }}
            >
              Próximamente
            </span>
          </div>
        </section>
      ))}

    </div>
  );
}
