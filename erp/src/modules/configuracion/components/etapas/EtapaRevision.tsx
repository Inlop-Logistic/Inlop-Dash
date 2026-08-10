/**
 * Etapa 07 — Revisión y activación
 *
 * Muestra un resumen de toda la configuración. La activación real
 * la ejecuta ConfiguradorReporte (botón "Activar reporte" en el footer).
 *
 * Al desarrollar las etapas 02-06, agregar cada sección de resumen aquí.
 */
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  ETAPAS,
  labelModulo, labelTipoReporte, labelFormato,
  etapaInfoBasicaCompleta,
  type DatosConfigurador,
} from "../../types";

interface Props {
  datos: DatosConfigurador;
}

export function EtapaRevision({ datos }: Props) {
  const ib = datos.infoBasica;
  const infoCompleta = etapaInfoBasicaCompleta(ib);

  // Etapas intermedias (02-06): pendientes de implementar
  const etapasPendientes = ETAPAS.filter(
    e => e.id !== "info-basica" && e.id !== "revision"
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

      {/* ─── Etapas 02-06: pendientes ─── */}
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
