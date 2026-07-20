import { useState, useEffect, useRef } from "react";
import { useNavigationContext } from "@/core/navigation";
import { useClientes } from "./hooks/useClientes";
import { ClientesListPage } from "./components/ClientesListPage";
import { ClienteWorkspace } from "./components/ClienteWorkspace";

export function ClientesPage() {
  const { navPayload, setVista } = useNavigationContext();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const state = useClientes();
  const payloadHandled = useRef(false);

  // Deep-link: si se navegó aquí con clienteId en el payload, abre el workspace
  useEffect(() => {
    if (payloadHandled.current) return;
    if (navPayload?.clienteId) {
      payloadHandled.current = true;
      setWorkspaceId(navPayload.clienteId);
      setVista("clientes"); // limpia el payload
    }
  }, [navPayload, setVista]);

  if (workspaceId) {
    return (
      <ClienteWorkspace
        clienteId={workspaceId}
        onBack={() => setWorkspaceId(null)}
      />
    );
  }

  return (
    <ClientesListPage
      state={state}
      onOpenWorkspace={(id) => setWorkspaceId(id)}
    />
  );
}
