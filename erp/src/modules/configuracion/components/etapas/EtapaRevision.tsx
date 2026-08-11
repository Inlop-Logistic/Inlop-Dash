/**
 * Etapa 06 — Revisión y activación
 *
 * Muestra un resumen de toda la configuración. La activación real
 * la ejecuta ConfiguradorReporte (botón "Activar reporte" en el footer).
 */
import { useEffect, useState }        from "react";
import { CheckCircle2, AlertCircle }  from "lucide-react";
import {
  labelModulo, labelTipoReporte, labelFormato, labelFrecuencia,
  etapaInfoBasicaCompleta, etapaFrecuenciaCompleta, etapaDestinatariosCompleta,
  DIAS_SEMANA,
  type DatosConfigurador,
  type FinRecurrencia,
  type PersonalInlop,
} from "../../types";
import { CAMPOS_FILTRO }  from "./filtros/catalogoFiltros";
import { buscarReporte }  from "../../catalogos/datasetsReportes";
import { listarPersonal } from "../../services/api";

interface Props {
  datos: DatosConfigurador;
}

/** "2026-08-11" → "11/08/2026" — evita el corrimiento de zona horaria de Date(). */
function formatFechaISO(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function labelFin(fin: FinRecurrencia): string {
  if (fin.modo === "nunca")        return "Sin fecha de finalización";
  if (fin.modo === "fecha")        return `Finaliza el ${formatFechaISO(fin.fecha)}`;
  return `Finaliza después de ${fin.cantidad} repetición${fin.cantidad !== 1 ? "es" : ""}`;
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
    ? [...datos.columnas]
        .filter(c => camposColumnaMap.has(c.campo))
        .sort((a, b) => a.orden - b.orden)
    : camposColumna.map((c, i) => ({ campo: c.key, titulo: c.label, orden: i }));

  const frecuencia = datos.frecuencia;
  const frecuenciaCompleta = etapaFrecuenciaCompleta(frecuencia);
  const diasSemanaLabel = DIAS_SEMANA
    .filter(d => (frecuencia.dias_semana ?? []).includes(d.value))
    .map(d => d.label)
    .join(", ");

  // Destinatarios: se necesitan nombre + correo del Personal INLOP
  // seleccionado — solo se persisten los ids, así que se resuelven aquí
  // contra la misma fuente real que usa la etapa 05 (GET /api/personal).
  const [personal, setPersonal] = useState<PersonalInlop[]>([]);
  useEffect(() => { listarPersonal().then(setPersonal).catch(() => {}); }, []);

  const destinatarios = datos.destinatarios;
  const destinatariosCompleta = etapaDestinatariosCompleta(destinatarios);
  const personalSeleccionado = personal.filter(p => destinatarios.personal_ids.includes(p.id));
  const totalDestinatarios = destinatarios.personal_ids.length + destinatarios.correos_externos.length;

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
            {columnasEfectivas.map((col, idx) => {
              const campo = camposColumnaMap.get(col.campo);
              const personalizado = campo && col.titulo !== campo.label;
              return (
                <div
                  key={col.campo}
                  className="flex items-baseline gap-2"
                  style={{ fontSize: "13px", color: "var(--gray-700)" }}
                >
                  <span
                    className="text-[10.5px] font-semibold tabular-nums"
                    style={{ color: "var(--gray-400)", minWidth: "18px" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontWeight: 500 }}>{col.titulo || campo?.label || col.campo}</span>
                  {personalizado && (
                    <span className="text-[11px]" style={{ color: "var(--gray-400)" }}>
                      (antes: {campo?.label})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Etapa 04: Frecuencia ─── */}
      <section
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{
          border:     `1.5px solid ${frecuenciaCompleta ? "var(--gray-200)" : "var(--danger-light)"}`,
          background: frecuenciaCompleta ? "var(--gray-50)" : "var(--danger-bg)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: frecuenciaCompleta ? "var(--gray-500)" : "var(--inlop-red)" }}
          >
            04 · Frecuencia
          </span>
          {frecuenciaCompleta
            ? <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
            : <AlertCircle  className="w-4 h-4" style={{ color: "var(--inlop-red)" }} />
          }
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          <div>
            <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Tipo</dt>
            <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
              {labelFrecuencia(frecuencia.tipo)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Hora(s) de envío</dt>
            <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
              {frecuencia.horas.length > 0 ? frecuencia.horas.join(", ") : "—"}
            </dd>
          </div>
          {frecuencia.tipo === "semanal" && (
            <div>
              <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Días</dt>
              <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
                {diasSemanaLabel || "—"}
              </dd>
            </div>
          )}
          {frecuencia.tipo === "mensual" && (
            <div>
              <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Día del mes</dt>
              <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
                {frecuencia.dia_mes ?? "—"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Comienzo</dt>
            <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
              {formatFechaISO(frecuencia.fecha_inicio)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold" style={{ color: "var(--gray-400)" }}>Finalización</dt>
            <dd className="text-[13px] mt-0.5" style={{ color: "var(--gray-700)" }}>
              {labelFin(frecuencia.fin)}
            </dd>
          </div>
        </dl>

        {!frecuenciaCompleta && (
          <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>
            Configuración incompleta — vuelve a la etapa 04 y completa los campos requeridos.
          </p>
        )}
      </section>

      {/* ─── Etapa 05: Destinatarios ─── */}
      <section
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{
          border:     `1.5px solid ${destinatariosCompleta ? "var(--gray-200)" : "var(--danger-light)"}`,
          background: destinatariosCompleta ? "var(--gray-50)" : "var(--danger-bg)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: destinatariosCompleta ? "var(--gray-500)" : "var(--inlop-red)" }}
          >
            05 · Destinatarios · {totalDestinatarios}
          </span>
          {destinatariosCompleta
            ? <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
            : <AlertCircle  className="w-4 h-4" style={{ color: "var(--inlop-red)" }} />
          }
        </div>

        {!destinatariosCompleta ? (
          <p className="text-[13px]" style={{ color: "var(--inlop-red)" }}>
            Sin destinatarios — vuelve a la etapa 05 y selecciona al menos uno.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {personalSeleccionado.map(p => (
              <li key={p.id} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--gray-700)" }}>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: "rgba(1, 42, 107, 0.08)", color: "var(--navy)" }}
                >
                  INLOP
                </span>
                <span style={{ fontWeight: 500 }}>{p.nombre || p.email}</span>
                <span style={{ color: "var(--gray-400)" }}>{p.email}</span>
              </li>
            ))}
            {destinatarios.correos_externos.map(email => (
              <li key={email} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--gray-700)" }}>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: "var(--gray-200)", color: "var(--gray-600)" }}
                >
                  EXTERNO
                </span>
                <span>{email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
