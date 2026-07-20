import { ArrowLeft, Building2, MapPin, User, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui";
import { ClienteTabs } from "./ClienteTabs";
import { useClienteDetalle } from "../hooks/useClienteDetalle";
import type { ClienteWorkspaceTab } from "../types";
import {
  ESTADO_CLIENTE_CFG,
  CLASIFICACION_ABC_CFG,
  NIVEL_ESTRATEGICO_CFG,
  ETIQUETA_CFG,
} from "../constants";
import { useState } from "react";

interface ClienteWorkspaceProps {
  clienteId: string;
  onBack: () => void;
}

function TabComingSoon({ tab }: { tab: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-3"
      style={{ color: "var(--gray-400)" }}
    >
      <div style={{ fontSize: 40 }}>🚧</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>
        Sección en construcción
      </div>
      <div style={{ fontSize: "var(--text-sm)" }}>
        {tab} estará disponible en la próxima fase.
      </div>
    </div>
  );
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

export function ClienteWorkspace({ clienteId, onBack }: ClienteWorkspaceProps) {
  const { cliente, loading, error } = useClienteDetalle(clienteId);
  const [activeTab, setActiveTab] = useState<ClienteWorkspaceTab>("perfil");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: "var(--gray-400)" }}>
        <span style={{ fontSize: "var(--text-md)" }}>Cargando cliente…</span>
      </div>
    );
  }

  if (error || !cliente) {
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

  const estadoCfg = ESTADO_CLIENTE_CFG[cliente.estado];
  const words = cliente.razon_social.trim().split(/\s+/).filter(Boolean);
  const initials = words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();

  const alertas = cliente.alertas_count > 0;

  return (
    <div className="flex flex-col min-h-0" style={{ background: "var(--gray-50)" }}>

      {/* ── Workspace Header ── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6"
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--gray-200)",
          height: 56,
          minHeight: 56,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
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
            style={{ fontSize: "var(--text-md)", color: "var(--navy)" }}
          >
            {cliente.razon_social}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {cliente.etiquetas.slice(0, 2).map(e => {
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
            Este cliente tiene {cliente.alertas_count} alerta{cliente.alertas_count !== 1 ? "s" : ""} activa{cliente.alertas_count !== 1 ? "s" : ""}.
            {" "}Revisa la sección de cada alerta para más detalles.
          </span>
        </div>
      )}

      {/* ── Executive Summary ── */}
      <div
        className="px-6 py-5"
        style={{ background: "#fff", borderBottom: "1px solid var(--gray-200)" }}
      >
        <div className="flex items-start gap-5 flex-wrap">

          {/* Avatar + Identity */}
          <div className="flex items-center gap-4">
            <div
              className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center font-bold"
              style={{
                background: "var(--navy)",
                color: "#fff",
                fontSize: "var(--text-xl)",
                letterSpacing: "-0.5px",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div
                className="font-bold leading-tight"
                style={{ fontSize: "var(--text-xl)", color: "var(--navy)" }}
              >
                {cliente.razon_social}
              </div>
              {cliente.nombre_comercial && cliente.nombre_comercial !== cliente.razon_social && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)", marginTop: 2 }}>
                  {cliente.nombre_comercial}
                </div>
              )}
              {cliente.nit && (
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--gray-500)",
                    fontFamily: "monospace",
                    marginTop: 2,
                  }}
                >
                  NIT {cliente.nit}
                </div>
              )}
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

      {/* ── Tab Bar ── */}
      <div
        className="sticky z-10 px-6"
        style={{
          top: 56,
          background: "#fff",
          borderBottom: "1px solid var(--gray-200)",
        }}
      >
        <ClienteTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "perfil" && <TabComingSoon tab="Perfil" />}
        {activeTab === "relaciones" && <TabComingSoon tab="Relaciones Comerciales" />}
        {activeTab === "contactos" && <TabComingSoon tab="Contactos" />}
        {activeTab === "sedes" && <TabComingSoon tab="Sedes" />}
        {activeTab === "documentos" && <TabComingSoon tab="Documentos" />}
        {activeTab === "condiciones_comerciales" && <TabComingSoon tab="Condiciones Comerciales" />}
        {activeTab === "condiciones_operativas" && <TabComingSoon tab="Condiciones Operativas" />}
        {activeTab === "tarifas" && <TabComingSoon tab="Tarifas" />}
        {activeTab === "solicitudes" && <TabComingSoon tab="Solicitudes" />}
        {activeTab === "viajes" && <TabComingSoon tab="Viajes" />}
        {activeTab === "facturacion" && <TabComingSoon tab="Facturación" />}
        {activeTab === "cartera" && <TabComingSoon tab="Cartera" />}
        {activeTab === "analitica" && <TabComingSoon tab="Analítica" />}
        {activeTab === "historial" && <TabComingSoon tab="Historial" />}
      </div>
    </div>
  );
}
