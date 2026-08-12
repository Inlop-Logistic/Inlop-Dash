import { Phone, MessageCircle } from "lucide-react";

interface Props {
  /** Solo se recibe si 10B llega a exponerlo — hoy `proyectarVehiculoPublico()`
   *  (services/gps/gpsSeguimiento.js) NO incluye teléfono; ver README.md de
   *  este proyecto, sección "Pendiente para 10D+". Este componente ya está
   *  listo para cuando exista esa política — hasta entonces simplemente no
   *  se monta (App/DetalleVehiculo lo condicionan). */
  telefono: string;
  nombreConductor?: string | null;
}

function soloDigitos(telefono: string): string {
  return telefono.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

/**
 * Nunca imprime el número como texto — solo botones de acción (tel:/wa.me).
 * Quien recibe el enlace puede llamar/escribir sin que el número quede
 * expuesto en pantalla (ni copiable por accidente en una captura).
 */
export function ContactoAcciones({ telefono, nombreConductor }: Props) {
  const digitos = soloDigitos(telefono);
  if (!digitos) return null;

  const etiqueta = nombreConductor ? `a ${nombreConductor}` : "al conductor";

  return (
    <div className="flex gap-2">
      <a
        href={`tel:${digitos}`}
        aria-label={`Llamar ${etiqueta}`}
        className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-[13.5px] rounded-xl py-3 transition-transform active:scale-[0.97]"
        style={{ background: "var(--navy)", color: "#fff" }}
      >
        <Phone className="w-4 h-4" />
        Llamar
      </a>
      <a
        href={`https://wa.me/${digitos}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Escribir por WhatsApp ${etiqueta}`}
        className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-[13.5px] rounded-xl py-3 transition-transform active:scale-[0.97]"
        style={{ background: "#25D366", color: "#fff" }}
      >
        <MessageCircle className="w-4 h-4" />
        WhatsApp
      </a>
    </div>
  );
}
