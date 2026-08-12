import { useState } from "react";
import { Link2Off, WifiOff, Clock } from "lucide-react";
import { useSeguimiento } from "./hooks/useSeguimiento";
import { PantallaCargando } from "./components/PantallaCargando";
import { PantallaMensaje } from "./components/PantallaMensaje";
import { PantallaVerificarCorreo } from "./components/PantallaVerificarCorreo";
import { PantallaOtp } from "./components/PantallaOtp";
import { PantallaSeguimiento } from "./components/PantallaSeguimiento";

/** Extrae el token de la URL: /t/<token>. Sin ruteo — es una app de un
 *  solo propósito, no hace falta react-router para una sola pantalla real. */
function tokenDeLaUrl(): string | null {
  const m = window.location.pathname.match(/^\/t\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const [token] = useState(tokenDeLaUrl);

  if (!token) {
    return (
      <PantallaMensaje
        icono={<Link2Off className="w-7 h-7" />}
        titulo="Enlace no disponible"
        cuerpo="Este enlace de seguimiento ya no está disponible. Solicita uno nuevo a quien te lo compartió."
        acento="neutral"
      />
    );
  }

  return <FlujoSeguimiento token={token} />;
}

function FlujoSeguimiento({ token }: { token: string }) {
  const { fase, vehiculos, cargandoVehiculos, redVehiculos, ultimaActualizacionLocal, acciones } = useSeguimiento(token);
  const [reintentando, setReintentando] = useState(false);

  async function reintentar() {
    setReintentando(true);
    await acciones.reintentarValidacion();
    setReintentando(false);
  }

  switch (fase.tipo) {
    case "cargando":
      return <PantallaCargando />;

    case "sin_conexion_inicial":
      return (
        <PantallaMensaje
          icono={<WifiOff className="w-7 h-7" />}
          titulo="Sin conexión"
          cuerpo="No pudimos conectarnos para verificar tu enlace. Revisa tu internet e inténtalo de nuevo."
          acento="neutral"
          accion={{ etiqueta: "Reintentar", onClick: reintentar, cargando: reintentando }}
        />
      );

    case "enlace_no_disponible":
      return (
        <PantallaMensaje
          icono={<Link2Off className="w-7 h-7" />}
          titulo="Seguimiento no disponible"
          cuerpo="Este enlace ya no está disponible — pudo vencerse o haber sido desactivado. Solicita un nuevo enlace a quien te compartió el reporte."
          acento="neutral"
        />
      );

    case "sesion_expirada":
      return (
        <PantallaMensaje
          icono={<Clock className="w-7 h-7" />}
          titulo="Tu sesión expiró"
          cuerpo="Por seguridad, las sesiones de seguimiento vencen después de un tiempo. Verifica tu correo de nuevo para continuar."
          acento="neutral"
          accion={{ etiqueta: "Verificar de nuevo", onClick: acciones.volverAPedirCorreo }}
        />
      );

    case "verificar_correo":
      return (
        <PantallaVerificarCorreo
          totalVehiculos={fase.totalVehiculos}
          enviando={fase.enviando}
          error={fase.error}
          onEnviar={acciones.enviarCorreo}
        />
      );

    case "otp":
      return (
        <PantallaOtp
          correo={fase.correo}
          validando={fase.validando}
          error={fase.error}
          mensaje={fase.mensaje}
          onValidar={acciones.validarCodigo}
          onReenviar={acciones.reenviarCodigo}
          onVolver={acciones.volverAPedirCorreo}
        />
      );

    case "sesion":
      return (
        <PantallaSeguimiento
          vehiculos={vehiculos}
          cargando={cargandoVehiculos}
          redOk={redVehiculos === "ok"}
          ultimaActualizacionLocal={ultimaActualizacionLocal}
        />
      );
  }
}
