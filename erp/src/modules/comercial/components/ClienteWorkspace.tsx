import { useState, useCallback } from "react";
import { ArrowLeft, Building2, MapPin, User, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui";
import { ClienteTabs } from "./ClienteTabs";
import { TabPerfil } from "./TabPerfil";
import { TabDeshabilitada } from "./TabDeshabilitada";
import { WorkspaceAcciones } from "./WorkspaceAcciones";
import { FormCambioEstado } from "./FormCambioEstado";
import { ModalFusionarCliente } from "./ModalFusionarCliente";
import { useClienteDetalle } from "../hooks/useClienteDetalle";
import { crearCliente } from "../services/api";
import type { ClienteWorkspaceTab, NuevoClienteFormData, ClienteListItem } from "../types";

const CONFIRM_DIRTY = "Tienes cambios sin guardar en el Perfil. ¿Deseas salir sin guardar?";
import {
  ESTADO_CLIENTE_CFG,
  CLASIFICACION_ABC_CFG,
  NIVEL_ESTRATEGICO_CFG,
  ETIQUETA_CFG,
} from "../constants";

// Tabs que requieren que el cliente exista físicamente en DB
const TABS_REQUIEREN_EXISTENCIA: ClienteWorkspaceTab[] = [
  "relaciones", "contactos", "sedes", "documentos",
  "condiciones_comerciales", "condiciones_operativas",
  "tarifas", "solicitudes", "viajes",
  "facturacion", "cartera", "analitica", "historial",
];

interface ClienteWorkspaceProps {
  clienteId: string;
  onBack: () => void;
  onClienteCreado?: (id: string) => void;
}

function MiniKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-4 py-3 rounded-xl"
      style={{ background: "var(--gray-50)", minWidth: 100 }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--navy)" }}>
        {value}
      </span>
    </div>
  );
}

export function ClienteWorkspace({ clienteId, onBack, onClienteCreado }: ClienteWorkspaceProps) {
  const esNuevo = clienteId === "nuevo";

  const { cliente, loading, error, saving, errorGuardar, guardar, cambiarEstado } =
    useClienteDetalle(clienteId);

  const [activeTab, setActiveTab]       = useState<ClienteWorkspaceTab>("perfil");
  const [editMode, setEditMode]         = useState(esNuevo);
  const [cambioEstadoOpen, setCambioEstadoOpen] = useState(false);
  const [fusionarOpen, setFusionarOpen] = useState(false);
  const [isFormDirty, setIsFormDirty]   = useState(false);

  // Maneja la creación de un cliente nuevo desde TabPerfil
  const handleCrear = useCallback(async (data: NuevoClienteFormData): Promise<ClienteListItem | null> => {
    try {
      const nuevo = await crearCliente(data);
      if (onClienteCreado) onClienteCreado(nuevo.id);
      return nuevo;
    } catch {
      return null;
    }
  }, [onClienteCreado]);

  // Navegación con protección de cambios sin guardar
  const handleBack = () => {
    if (isFormDirty && !window.confirm(CONFIRM_DIRTY)) return;
    setIsFormDirty(false);
    onBack();
  };

  const handleTabChange = (tab: ClienteWorkspaceTab) => {
    if (tabDeshabilitada(tab)) return;
    if (activeTab === "perfil" && isFormDirty && tab !== "perfil") {
      if (!window.confirm(CONFIRM_DIRTY)) return;
      setIsFormDirty(false);
      setEditMode(false);
    }
    setActiveTab(tab);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!esNuevo && loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--gray-400)" }}>
        <span style={{ fontSize: "var(--text-md)" }}>Cargando cliente…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (!esNuevo && (error || !cliente)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: "var(--gray-500)" }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>
          {error ?? "Cliente no encontrado"}
        </div>
        <button
          onClick={onBack}
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--navy)",
            textDecoration: "underline",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Volver a Clientes
        </button>
      </div>
    );
  }

  // ── Datos para el header ──────────────────────────────────────────────────
  const estadoActual = cliente?.estado ?? "prospecto";
  const estadoCfg = ESTADO_CLIENTE_CFG[estadoActual];

  const nombreDisplay = esNuevo ? "Nuevo Cliente" : (cliente?.razon_social ?? "");
  const words = nombreDisplay.trim().split(/\s+/).filter(Boolean);
  const initials = words.length === 0
    ? "NC"
    : words.length === 1
      ? words[0].slice(0, 2).toUpperCase()
      : (words[0][0] + words[words.length - 1][0]).toUpperCase();

  const alertas = (cliente?.alertas_count ?? 0) > 0;

  // Una tab está deshabilitada si el cliente aún no existe en DB
  const tabDeshabilitada = (tab: ClienteWorkspaceTab) =>
    esNuevo && TABS_REQUIEREN_EXISTENCIA.includes(tab);

  return (
    <div className="flex flex-col min-h-0" style={{ background: "var(--gray-50)" }}>

      {/* ── Workspace Header ── */}
      <div
        className="sticky top-0 z-20"
        style={{ background: "#fff", borderBottom: "1px solid var(--gray-200)" }}
      >
        {/* Top row: breadcrumb + estado + etiquetas */}
        <div className="flex items-center justify-between gap-4 px-6" style={{ height: 52, minHeight: 52 }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 shrink-0 font-medium transition-colors"
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--gray-500)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--navy)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-500)")}
            >
              <ArrowLeft className="w-4 h-4" />
              Clientes
            </button>
            <span style={{ color: "var(--gray-300)" }}>/</span>
            <span
              className="font-semibold truncate"
              style={{ fontSize: "var(--text-md)", color: esNuevo ? "var(--gray-400)" : "var(--navy)" }}
            >
              {nombreDisplay}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!esNuevo && (cliente?.etiquetas ?? []).slice(0, 2).map(e => {
              const cfg = ETIQUETA_CFG[e];
              return (
                <span
                  key={e}
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "8px",
                    background: cfg.bg,
                    color: cfg.color,
                  }}
                >
                  {cfg.label}
                </span>
              );
            })}
            <Badge variant={estadoCfg.variant}>{estadoCfg.label}</Badge>
          </div>
        </div>

        {/* Second row: quick actions (solo para clientes existentes) */}
        {!esNuevo && (
          <div className="px-6 pb-3 flex items-center justify-between gap-4">
            <WorkspaceAcciones
              esNuevo={esNuevo}
              onEditar={() => { setActiveTab("perfil"); setEditMode(true); }}
              onCambiarEstado={() => setCambioEstadoOpen(true)}
              onNuevaSolicitud={() => {}}
              onNuevoContacto={() => { setActiveTab("contactos"); }}
              onNuevaTarifa={() => {}}
              onSubirDocumento={() => { setActiveTab("documentos"); }}
              onFusionar={() => setFusionarOpen(true)}
            />
          </div>
        )}
      </div>

      {/* ── Alert Strip ── */}
      {alertas && (
        <div
          className="flex items-center gap-2 px-6 py-2.5"
          style={{
            background: "#FEF3C7",
            borderBottom: "1px solid #FDE68A",
            fontSize: "var(--text-sm)",
            color: "#92400E",
            fontWeight: 500,
          }}
        >
          <span>⚠</span>
          <span>
            Este cliente tiene {cliente!.alertas_count} alerta{cliente!.alertas_count !== 1 ? "s" : ""} activa{cliente!.alertas_count !== 1 ? "s" : ""}.
          </span>
        </div>
      )}

      {/* ── Executive Summary (solo clientes existentes) ── */}
      {!esNuevo && cliente && (
        <div
          className="px-6 py-5"
          style={{ background: "#fff", borderBottom: "1px solid var(--gray-200)" }}
        >
          <div className="flex items-start gap-5 flex-wrap">

            {/* Avatar + Identity */}
            <div className="flex items-center gap-4">
              <div
                className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center font-bold"
                style={{ background: "var(--navy)", color: "#fff", fontSize: "var(--text-xl)", letterSpacing: "-0.5px" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="font-bold leading-tight" style={{ fontSize: "var(--text-xl)", color: "var(--navy)" }}>
                  {cliente.razon_social}
                </div>
                {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.razon_social && (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)", marginTop: 2 }}>
                    {cliente.nombre_comercial}
                  </div>
                )}
                <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", fontFamily: "monospace", marginTop: 2 }}>
                  {cliente.codigo_cliente ?? ""}
                  {cliente.nit && ` · NIT ${cliente.nit}${cliente.dv ? `-${cliente.dv}` : ""}`}
                </div>
              </div>
            </div>

            {/* Meta fields */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 items-center" style={{ marginTop: 2 }}>
              {cliente.ciudad_principal && (
                <div className="flex items-center gap-1.5" style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
                  {cliente.ciudad_principal}
                </div>
              )}
              {cliente.sector_economico && (
                <div className="flex items-center gap-1.5" style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>
                  <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
                  {cliente.sector_economico}
                </div>
              )}
              {cliente.ejecutivo_comercial && (
                <div className="flex items-center gap-1.5" style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>
                  <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
                  {cliente.ejecutivo_comercial}
                </div>
              )}
              {cliente.clasificacion_abc && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "11px",
                      padding: "2px 10px",
                      borderRadius: "10px",
                      background: CLASIFICACION_ABC_CFG[cliente.clasificacion_abc].bg,
                      color: CLASIFICACION_ABC_CFG[cliente.clasificacion_abc].color,
                    }}
                  >
                    {cliente.clasificacion_abc}
                  </span>
                </div>
              )}
              {cliente.nivel_estrategico && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "8px",
                    background: NIVEL_ESTRATEGICO_CFG[cliente.nivel_estrategico].bg,
                    color: NIVEL_ESTRATEGICO_CFG[cliente.nivel_estrategico].color,
                  }}
                >
                  {NIVEL_ESTRATEGICO_CFG[cliente.nivel_estrategico].label}
                </span>
              )}
            </div>

            {/* Mini KPIs */}
            <div className="flex gap-3 ml-auto flex-wrap">
              <MiniKpi label="Solicitudes" value="—" />
              <MiniKpi label="Viajes" value="—" />
              <MiniKpi label="Documentos" value="—" />
              <MiniKpi label="Últ. actividad" value="—" />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div
        className="sticky z-10 px-6"
        style={{ top: esNuevo ? 52 : 96, background: "#fff", borderBottom: "1px solid var(--gray-200)" }}
      >
        <ClienteTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          disabledTabs={esNuevo ? TABS_REQUIEREN_EXISTENCIA : []}
        />
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === "perfil" && (
          <TabPerfil
            cliente={cliente}
            esNuevo={esNuevo}
            editMode={editMode}
            onSetEditMode={setEditMode}
            saving={saving}
            errorGuardar={errorGuardar}
            onGuardar={guardar}
            onCrear={handleCrear}
            onDirtyChange={setIsFormDirty}
          />
        )}
        {TABS_REQUIEREN_EXISTENCIA.map(tab => {
          if (activeTab !== tab) return null;
          if (tabDeshabilitada(tab)) return <TabDeshabilitada key={tab} tab={tab} />;
          return (
            <div key={tab} className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--gray-400)" }}>
              <div style={{ fontSize: 40 }}>🚧</div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>Sección en construcción</div>
              <div style={{ fontSize: "var(--text-sm)" }}>{tab} estará disponible en la próxima fase.</div>
            </div>
          );
        })}
      </div>

      {/* ── Form Cambio Estado ── */}
      {!esNuevo && cliente && (
        <FormCambioEstado
          open={cambioEstadoOpen}
          estadoActual={estadoActual}
          onClose={() => setCambioEstadoOpen(false)}
          onGuardar={async (payload) => {
            return cambiarEstado(payload);
          }}
          saving={saving}
        />
      )}

      {/* ── Modal Fusionar Cliente ── */}
      {!esNuevo && fusionarOpen && cliente && (
        <ModalFusionarCliente
          clienteOficial={cliente}
          onClose={() => setFusionarOpen(false)}
          onSuccess={(id) => { setFusionarOpen(false); onBack(); }}
        />
      )}
    </div>
  );
}
