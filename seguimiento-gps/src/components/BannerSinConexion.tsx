import { WifiOff } from "lucide-react";

/**
 * Banner no bloqueante para un hiccup transitorio de red durante el polling
 * de /vehiculos — nunca reemplaza la vista, solo avisa mientras se sigue
 * mostrando el último dato conocido (mejor UX que un error de pantalla
 * completa por una falla momentánea de conexión).
 */
export function BannerSinConexion() {
  return (
    <div
      className="flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2"
      style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
      role="status"
    >
      <WifiOff className="w-3.5 h-3.5" />
      Sin conexión — mostrando la última actualización disponible
    </div>
  );
}
