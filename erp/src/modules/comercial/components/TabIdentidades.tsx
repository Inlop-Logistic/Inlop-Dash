import { useState, useEffect } from "react";
import { Plus, Eye, EyeOff, GitMerge, AlertTriangle } from "lucide-react";
import type { ClienteAlias } from "../types";
import { getAliases, crearAlias, toggleAlias } from "../services/api";

interface TabIdentidadesProps {
  clienteId: string;
}

const INTEGRACIONES = [
  { value: "controlt", label: "ControlT" },
  { value: "syscar",   label: "SYSCAR"   },
  { value: "otro",     label: "Otro"     },
];

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });
}

function Badge({ activo }: { activo: boolean }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 8,
        background: activo ? "#D1FAE5" : "var(--gray-100)",
        color:      activo ? "#065F46" : "var(--gray-400)",
      }}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

export function TabIdentidades({ clienteId }: TabIdentidadesProps) {
  const [aliases, setAliases]   = useState<ClienteAlias[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [creando, setCreando]   = useState(false);
  const [nombre, setNombre]     = useState("");
  const [integracion, setInteg] = useState("controlt");
  const [observacion, setObs]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAliases(clienteId)
      .then(setAliases)
      .catch(e => setError(e instanceof Error ? e.message : "Error al cargar identidades"))
      .finally(() => setLoading(false));
  }, [clienteId]);

  async function handleCrear() {
    if (!nombre.trim()) return;
    setSaving(true);
    setCreateErr(null);
    try {
      const alias = await crearAlias(clienteId, {
        nombre_raw:  nombre.trim(),
        integracion,
        observacion: observacion.trim() || undefined,
      });
      setAliases(prev => [alias, ...prev]);
      setNombre("");
      setInteg("controlt");
      setObs("");
      setCreando(false);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Error al crear identidad");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(alias: ClienteAlias) {
    setSavingId(alias.id);
    setError(null);
    try {
      await toggleAlias(clienteId, alias.id, !alias.activo);
      setAliases(prev => prev.map(a => a.id === alias.id ? { ...a, activo: !a.activo } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar identidad");
    } finally {
      setSavingId(null);
    }
  }

  const activas   = aliases.filter(a => a.activo);
  const inactivas = aliases.filter(a => !a.activo);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 760 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--navy)", display: "flex", alignItems: "center", gap: 8 }}>
            <GitMerge style={{ width: 18, height: 18 }} />
            Identidades de Integración
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-500)", marginTop: 4, lineHeight: 1.5 }}>
            Nombres alternativos que ControlT u otras integraciones usan para este cliente.
            Los alias activos dirigen las syncs al cliente oficial sin crear duplicados.
          </div>
        </div>
        <button
          onClick={() => { setCreando(v => !v); setCreateErr(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            border: "1px solid var(--gray-200)", background: "#fff",
            fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--gray-700)",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Nueva Identidad
        </button>
      </div>

      {/* Error global */}
      {error && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", color: "#991B1B", fontSize: "var(--text-sm)", marginBottom: 16 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Formulario de creación */}
      {creando && (
        <div
          style={{
            padding: 16, borderRadius: 10, marginBottom: 20,
            border: "1.5px solid var(--gray-200)", background: "var(--gray-50)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--navy)", marginBottom: 12 }}>
            Nueva identidad manual
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--gray-500)", fontWeight: 600 }}>
                Nombre externo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                autoFocus
                type="text"
                placeholder="Ej: FRONTERA ENERGY COLOMBIA CORP SUCURSAL"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCrear()}
                style={{
                  padding: "8px 10px", borderRadius: 7, fontSize: "var(--text-sm)",
                  border: "1.5px solid var(--gray-200)", color: "var(--gray-700)", outline: "none",
                }}
              />
            </div>
            <div style={{ flex: "0 1 160px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: "var(--text-xs)", color: "var(--gray-500)", fontWeight: 600 }}>
                Integración
              </label>
              <select
                value={integracion}
                onChange={e => setInteg(e.target.value)}
                style={{
                  padding: "8px 10px", borderRadius: 7, fontSize: "var(--text-sm)",
                  border: "1.5px solid var(--gray-200)", color: "var(--gray-700)",
                  background: "#fff", cursor: "pointer", outline: "none",
                }}
              >
                {INTEGRACIONES.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--gray-500)", fontWeight: 600 }}>
              Observación <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Nombre en ControlT hasta fusión de mayo 2026"
              value={observacion}
              onChange={e => setObs(e.target.value)}
              style={{
                padding: "8px 10px", borderRadius: 7, fontSize: "var(--text-sm)",
                border: "1.5px solid var(--gray-200)", color: "var(--gray-700)", outline: "none",
              }}
            />
          </div>
          {createErr && (
            <div style={{ fontSize: "var(--text-xs)", color: "#DC2626", marginBottom: 10 }}>{createErr}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setCreando(false); setNombre(""); setObs(""); setCreateErr(null); }}
              style={{
                padding: "7px 14px", borderRadius: 7,
                border: "1px solid var(--gray-200)", background: "#fff",
                fontSize: "var(--text-sm)", color: "var(--gray-600)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={saving || !nombre.trim()}
              style={{
                padding: "7px 16px", borderRadius: 7, border: "none",
                background: saving || !nombre.trim() ? "var(--gray-200)" : "var(--navy)",
                color: saving || !nombre.trim() ? "var(--gray-400)" : "#fff",
                fontSize: "var(--text-sm)", fontWeight: 600,
                cursor: saving || !nombre.trim() ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Guardando…" : "Guardar identidad"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--gray-400)", fontSize: "var(--text-sm)" }}>
          Cargando identidades…
        </div>
      )}

      {/* Empty state */}
      {!loading && aliases.length === 0 && (
        <div
          style={{
            padding: "40px 24px", textAlign: "center",
            borderRadius: 12, border: "1px dashed var(--gray-200)", color: "var(--gray-400)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: 4 }}>
            Sin identidades registradas
          </div>
          <div style={{ fontSize: "var(--text-sm)" }}>
            Los alias se crean automáticamente al fusionar clientes duplicados,
            o puedes añadir uno manualmente con el botón de arriba.
          </div>
        </div>
      )}

      {/* Tabla de alias activos */}
      {!loading && activas.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Activos ({activas.length})
          </div>
          <AliasTable rows={activas} savingId={savingId} onToggle={handleToggle} />
        </div>
      )}

      {/* Tabla de alias inactivos */}
      {!loading && inactivas.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Inactivos ({inactivas.length})
          </div>
          <AliasTable rows={inactivas} savingId={savingId} onToggle={handleToggle} />
        </div>
      )}
    </div>
  );
}

interface AliasTableProps {
  rows:     ClienteAlias[];
  savingId: string | null;
  onToggle: (alias: ClienteAlias) => void;
}

function AliasTable({ rows, savingId, onToggle }: AliasTableProps) {
  return (
    <div style={{ border: "1px solid var(--gray-200)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((alias, i) => (
        <div
          key={alias.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: 12, alignItems: "center",
            padding: "12px 16px",
            borderTop: i === 0 ? "none" : "1px solid var(--gray-100)",
            background: alias.activo ? "#fff" : "var(--gray-50)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: alias.activo ? "var(--gray-800)" : "var(--gray-400)", fontFamily: "monospace", wordBreak: "break-all" }}>
              {alias.nombre_raw}
            </div>
            {alias.observacion && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--gray-400)", marginTop: 2 }}>
                {alias.observacion}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>
                {INTEGRACIONES.find(i => i.value === alias.integracion)?.label ?? alias.integracion}
              </span>
              <span style={{ fontSize: "11px", color: "var(--gray-300)" }}>·</span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>
                {alias.creado_via === "merge" ? "Por fusión" : "Manual"}
              </span>
              {alias.creado_por && (
                <>
                  <span style={{ fontSize: "11px", color: "var(--gray-300)" }}>·</span>
                  <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{alias.creado_por}</span>
                </>
              )}
              <span style={{ fontSize: "11px", color: "var(--gray-300)" }}>·</span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{fmtFecha(alias.creado_en)}</span>
            </div>
          </div>

          <Badge activo={alias.activo} />

          <button
            onClick={() => onToggle(alias)}
            disabled={savingId === alias.id}
            title={alias.activo ? "Desactivar" : "Activar"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 7,
              border: "1px solid var(--gray-200)", background: "#fff",
              fontSize: "var(--text-xs)", fontWeight: 500,
              color: alias.activo ? "#991B1B" : "#065F46",
              cursor: savingId === alias.id ? "not-allowed" : "pointer",
              opacity: savingId === alias.id ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {alias.activo
              ? <><EyeOff style={{ width: 12, height: 12 }} /> Desactivar</>
              : <><Eye    style={{ width: 12, height: 12 }} /> Activar</>
            }
          </button>
        </div>
      ))}
    </div>
  );
}
