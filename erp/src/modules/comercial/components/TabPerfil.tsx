import { useState, useEffect, useRef } from "react";
import { Edit2, Save, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui";
import type { ClienteDetalle, NuevoClienteFormData } from "../types";
import { TIPO_CLIENTE_CFG, TIPO_EMPRESA_CFG, ETIQUETA_CFG } from "../constants";
import type { EtiquetaCliente, TipoCliente, TipoEmpresa, RegimenTributario, CanalComercial, NivelEstrategico, ClasificacionABC } from "../types";

// ── Primitivos de formulario ─────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--gray-500)",
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  fontSize: "var(--text-md)",
  color: "var(--gray-800)",
  border: "1px solid var(--gray-200)",
  borderRadius: 8,
  padding: "8px 12px",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

const READ_STYLE: React.CSSProperties = {
  fontSize: "var(--text-md)",
  color: "var(--gray-800)",
  padding: "8px 0",
  display: "block",
  minHeight: 36,
};

function Field({
  label, value, edit, children,
}: { label: string; value: string | null | undefined; edit: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {edit
        ? children
        : <span style={READ_STYLE}>{value || <span style={{ color: "var(--gray-300)" }}>—</span>}</span>
      }
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--navy)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "2px solid var(--navy)",
          display: "inline-block",
        }}
      >
        {title}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {children}
      </div>
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TabPerfilProps {
  cliente: ClienteDetalle | null;
  esNuevo: boolean;
  editMode: boolean;
  onSetEditMode: (v: boolean) => void;
  saving: boolean;
  errorGuardar: string | null;
  onGuardar: (data: Partial<NuevoClienteFormData>) => Promise<ClienteDetalle | null>;
  onCrear: (data: NuevoClienteFormData) => Promise<{ id: string } | null>;
  onDirtyChange?: (dirty: boolean) => void;
}

// Formulario vacío para modo creación
const EMPTY: NuevoClienteFormData = {
  razon_social: "",
  nit: "",
  dv: "",
  nombre_comercial: "",
  estado: "prospecto",
  sector_economico: "",
  tipo_empresa: undefined,
  tipo_cliente: undefined,
  ciudad_principal: "",
  departamento: "",
  pais: "Colombia",
  direccion: "",
  telefono: "",
  email_principal: "",
  pagina_web: "",
  descripcion: "",
  ejecutivo_comercial: "",
  director_comercial: "",
  coordinador_operativo: "",
  canal_comercial: undefined,
  clasificacion_abc: undefined,
  nivel_estrategico: undefined,
  segmento: "",
  etiquetas: [],
  regimen_tributario: undefined,
  tipo_contribuyente: undefined,
  responsable_iva: false,
  gran_contribuyente: false,
  autorretenedor: false,
  actividad_economica: "",
};

function clienteToForm(c: ClienteDetalle): NuevoClienteFormData {
  return {
    razon_social:          c.razon_social,
    nit:                   c.nit ?? "",
    dv:                    c.dv ?? "",
    nombre_comercial:      c.nombre_comercial ?? "",
    sector_economico:      c.sector_economico ?? "",
    tipo_empresa:          c.tipo_empresa ?? undefined,
    tipo_cliente:          c.tipo_cliente ?? undefined,
    ciudad_principal:      c.ciudad_principal ?? "",
    departamento:          c.departamento ?? "",
    pais:                  c.pais ?? "Colombia",
    direccion:             c.direccion ?? "",
    telefono:              c.telefono ?? "",
    email_principal:       c.email_principal ?? "",
    pagina_web:            c.pagina_web ?? "",
    descripcion:           c.descripcion ?? "",
    ejecutivo_comercial:   c.ejecutivo_comercial ?? "",
    director_comercial:    c.director_comercial ?? "",
    coordinador_operativo: c.coordinador_operativo ?? "",
    canal_comercial:       c.canal_comercial ?? undefined,
    clasificacion_abc:     c.clasificacion_abc ?? undefined,
    nivel_estrategico:     c.nivel_estrategico ?? undefined,
    segmento:              c.segmento ?? "",
    etiquetas:             c.etiquetas ?? [],
    regimen_tributario:    c.regimen_tributario ?? undefined,
    tipo_contribuyente:    c.tipo_contribuyente ?? undefined,
    responsable_iva:       c.responsable_iva ?? false,
    gran_contribuyente:    c.gran_contribuyente ?? false,
    autorretenedor:        c.autorretenedor ?? false,
    actividad_economica:   c.actividad_economica ?? "",
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TabPerfil({
  cliente, esNuevo, editMode, onSetEditMode, saving, errorGuardar, onGuardar, onCrear, onDirtyChange,
}: TabPerfilProps) {
  const [form, setForm] = useState<NuevoClienteFormData>(() =>
    esNuevo ? EMPTY : (cliente ? clienteToForm(cliente) : EMPTY)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Ref para acceder siempre al cliente más reciente sin disparar efectos
  const clienteRef = useRef(cliente);
  clienteRef.current = cliente;

  // Re-sincronizar form cuando se entra en modo edición (desde WorkspaceAcciones o botón Editar)
  useEffect(() => {
    if (!editMode || esNuevo) return;
    const c = clienteRef.current;
    if (c) {
      setForm(clienteToForm(c));
      markClean();
    }
  // Solo se dispara cuando cambia editMode o esNuevo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, esNuevo]);

  const markDirty = () => {
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  };

  const markClean = () => {
    setIsDirty(false);
    onDirtyChange?.(false);
  };

  const set = <K extends keyof NuevoClienteFormData>(key: K, value: NuevoClienteFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const handleGuardar = async () => {
    if (!form.razon_social.trim()) return;
    setSaved(false);
    if (esNuevo) {
      const result = await onCrear(form);
      if (result) { setSaved(true); markClean(); }
    } else {
      const result = await onGuardar(form);
      if (result) { setSaved(true); markClean(); onSetEditMode(false); }
    }
  };

  const handleCancelar = () => {
    const c = clienteRef.current;
    setForm(c ? clienteToForm(c) : EMPTY);
    markClean();
    onSetEditMode(false);
    setSaved(false);
  };

  const toggleEtiqueta = (e: EtiquetaCliente) => {
    const curr = form.etiquetas ?? [];
    set("etiquetas", curr.includes(e) ? curr.filter(x => x !== e) : [...curr, e]);
  };

  const edit = editMode || esNuevo;
  const selectStyle = INPUT_STYLE;

  return (
    <div className="flex flex-col gap-0">

      {/* Action bar */}
      {!esNuevo && (
        <div
          className="flex items-center justify-between px-6 py-3 sticky top-0 z-10"
          style={{ background: "#fff", borderBottom: "1px solid var(--gray-100)" }}
        >
          <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)" }}>
            {editMode
              ? isDirty
                ? "Editando perfil — hay cambios sin guardar."
                : "Editando perfil — los cambios no se guardan solos."
              : "Vista de solo lectura."}
          </span>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={handleCancelar} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleGuardar}>
                  Guardar cambios
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => onSetEditMode(true)}>
                Editar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="px-6 py-6 flex flex-col gap-8">

        {/* ── 1. Información General ── */}
        <Section title="Información General">
          <Field label="Razón Social *" value={form.razon_social} edit={edit}>
            <input
              type="text"
              value={form.razon_social}
              onChange={e => set("razon_social", e.target.value)}
              placeholder="Razón social completa"
              style={{ ...INPUT_STYLE, borderColor: !form.razon_social.trim() && edit ? "var(--inlop-red)" : "var(--gray-200)" }}
            />
          </Field>
          <Field label="Nombre Comercial" value={form.nombre_comercial} edit={edit}>
            <input type="text" value={form.nombre_comercial ?? ""} onChange={e => set("nombre_comercial", e.target.value)} placeholder="Nombre como se conoce en el mercado" style={INPUT_STYLE} />
          </Field>
          <Field label="NIT" value={form.nit} edit={edit}>
            <div className="flex gap-2">
              <input type="text" value={form.nit ?? ""} onChange={e => set("nit", e.target.value)} placeholder="900123456" style={{ ...INPUT_STYLE, flex: 1 }} />
              <input type="text" value={form.dv ?? ""} onChange={e => set("dv", e.target.value)} placeholder="DV" style={{ ...INPUT_STYLE, width: 60, flex: "none", textAlign: "center" }} maxLength={1} />
            </div>
          </Field>
          <Field label="Tipo de Empresa" value={form.tipo_empresa ? TIPO_EMPRESA_CFG[form.tipo_empresa] : null} edit={edit}>
            <select value={form.tipo_empresa ?? ""} onChange={e => set("tipo_empresa", (e.target.value as TipoEmpresa) || undefined)} style={selectStyle}>
              <option value="">Seleccionar…</option>
              {(Object.entries(TIPO_EMPRESA_CFG) as [TipoEmpresa, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Tipo de Cliente" value={form.tipo_cliente ? TIPO_CLIENTE_CFG[form.tipo_cliente] : null} edit={edit}>
            <select value={form.tipo_cliente ?? ""} onChange={e => set("tipo_cliente", (e.target.value as TipoCliente) || undefined)} style={selectStyle}>
              <option value="">Seleccionar…</option>
              {(Object.entries(TIPO_CLIENTE_CFG) as [TipoCliente, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Sector Económico" value={form.sector_economico} edit={edit}>
            <input type="text" value={form.sector_economico ?? ""} onChange={e => set("sector_economico", e.target.value)} placeholder="Ej: Manufactura, Logística, Retail" style={INPUT_STYLE} />
          </Field>
        </Section>

        {/* ── 2. Información Comercial ── */}
        <Section title="Información Comercial">
          <Field label="Ejecutivo Comercial" value={form.ejecutivo_comercial} edit={edit}>
            <input type="text" value={form.ejecutivo_comercial ?? ""} onChange={e => set("ejecutivo_comercial", e.target.value)} placeholder="Nombre del ejecutivo" style={INPUT_STYLE} />
          </Field>
          <Field label="Director Comercial" value={form.director_comercial} edit={edit}>
            <input type="text" value={form.director_comercial ?? ""} onChange={e => set("director_comercial", e.target.value)} placeholder="Nombre del director" style={INPUT_STYLE} />
          </Field>
          <Field label="Coordinador Operativo" value={form.coordinador_operativo} edit={edit}>
            <input type="text" value={form.coordinador_operativo ?? ""} onChange={e => set("coordinador_operativo", e.target.value)} placeholder="Nombre del coordinador" style={INPUT_STYLE} />
          </Field>
          <Field label="Clasificación ABC" value={form.clasificacion_abc ?? null} edit={edit}>
            <select value={form.clasificacion_abc ?? ""} onChange={e => set("clasificacion_abc", (e.target.value as ClasificacionABC) || undefined)} style={selectStyle}>
              <option value="">Sin clasificar</option>
              <option value="A">A — Alto valor</option>
              <option value="B">B — Valor medio</option>
              <option value="C">C — Bajo valor</option>
            </select>
          </Field>
          <Field label="Nivel Estratégico" value={form.nivel_estrategico ?? null} edit={edit}>
            <select value={form.nivel_estrategico ?? ""} onChange={e => set("nivel_estrategico", (e.target.value as NivelEstrategico) || undefined)} style={selectStyle}>
              <option value="">Sin definir</option>
              <option value="estrategico">Estratégico</option>
              <option value="clave">Clave</option>
              <option value="estandar">Estándar</option>
              <option value="transaccional">Transaccional</option>
            </select>
          </Field>
          <Field label="Canal Comercial" value={form.canal_comercial ?? null} edit={edit}>
            <select value={form.canal_comercial ?? ""} onChange={e => set("canal_comercial", (e.target.value as CanalComercial) || undefined)} style={selectStyle}>
              <option value="">Sin definir</option>
              <option value="directo">Directo</option>
              <option value="referido">Referido</option>
              <option value="licitacion">Licitación</option>
              <option value="otro">Otro</option>
            </select>
          </Field>
          <Field label="Segmento" value={form.segmento} edit={edit}>
            <input type="text" value={form.segmento ?? ""} onChange={e => set("segmento", e.target.value)} placeholder="Ej: Empresas medianas, Retail nacional" style={INPUT_STYLE} />
          </Field>
        </Section>

        {/* ── 3. Etiquetas ── */}
        <div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--navy)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: "2px solid var(--navy)",
              display: "inline-block",
            }}
          >
            Etiquetas
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ETIQUETA_CFG) as [EtiquetaCliente, typeof ETIQUETA_CFG[EtiquetaCliente]][]).map(([key, cfg]) => {
              const active = (form.etiquetas ?? []).includes(key);
              if (!edit) {
                return active ? (
                  <span
                    key={key}
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: cfg.bg,
                      color: cfg.color,
                    }}
                  >
                    {cfg.label}
                  </span>
                ) : null;
              }
              return (
                <button
                  key={key}
                  onClick={() => toggleEtiqueta(key)}
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: active ? cfg.bg : "var(--gray-50)",
                    color: active ? cfg.color : "var(--gray-500)",
                    border: active ? `1.5px solid ${cfg.color}` : "1.5px solid var(--gray-200)",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {active && <CheckCircle className="w-3 h-3 inline mr-1" />}
                  {cfg.label}
                </button>
              );
            })}
            {!edit && (form.etiquetas ?? []).length === 0 && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-300)" }}>Sin etiquetas</span>
            )}
          </div>
        </div>

        {/* ── 4. Información Tributaria ── */}
        <Section title="Información Tributaria">
          <Field label="Régimen Tributario" value={form.regimen_tributario ?? null} edit={edit}>
            <select value={form.regimen_tributario ?? ""} onChange={e => set("regimen_tributario", (e.target.value as RegimenTributario) || undefined)} style={selectStyle}>
              <option value="">Sin definir</option>
              <option value="comun">Responsable de IVA (Común)</option>
              <option value="simple">Régimen Simple de Tributación</option>
              <option value="no_responsable">No Responsable de IVA</option>
            </select>
          </Field>
          <Field label="Tipo de Persona" value={form.tipo_contribuyente ?? null} edit={edit}>
            <select value={form.tipo_contribuyente ?? ""} onChange={e => set("tipo_contribuyente", (e.target.value as "natural" | "juridica") || undefined)} style={selectStyle}>
              <option value="">Sin definir</option>
              <option value="juridica">Persona Jurídica</option>
              <option value="natural">Persona Natural</option>
            </select>
          </Field>
          <Field label="Actividad Económica (CIIU)" value={form.actividad_economica} edit={edit}>
            <input type="text" value={form.actividad_economica ?? ""} onChange={e => set("actividad_economica", e.target.value)} placeholder="Código CIIU" style={INPUT_STYLE} />
          </Field>
          {edit ? (
            <div className="flex flex-col gap-2" style={{ gridColumn: "1 / -1" }}>
              {([
                ["responsable_iva",   "Responsable de IVA"],
                ["gran_contribuyente","Gran Contribuyente"],
                ["autorretenedor",    "Autorretenedor"],
              ] as [keyof NuevoClienteFormData, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form[key]}
                    onChange={e => set(key, e.target.checked as NuevoClienteFormData[typeof key])}
                    style={{ width: 16, height: 16, accentColor: "var(--navy)" }}
                  />
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-700)" }}>{label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1" style={{ gridColumn: "1 / -1" }}>
              {form.responsable_iva    && <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>✓ Responsable de IVA</span>}
              {form.gran_contribuyente && <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>✓ Gran Contribuyente</span>}
              {form.autorretenedor     && <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-600)" }}>✓ Autorretenedor</span>}
              {!form.responsable_iva && !form.gran_contribuyente && !form.autorretenedor && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--gray-300)" }}>Sin obligaciones especiales registradas</span>
              )}
            </div>
          )}
        </Section>

        {/* ── 5. Ubicación y Contacto ── */}
        <Section title="Ubicación y Contacto">
          <Field label="País" value={form.pais} edit={edit}>
            <input type="text" value={form.pais ?? "Colombia"} onChange={e => set("pais", e.target.value)} style={INPUT_STYLE} />
          </Field>
          <Field label="Departamento" value={form.departamento} edit={edit}>
            <input type="text" value={form.departamento ?? ""} onChange={e => set("departamento", e.target.value)} placeholder="Ej: Cundinamarca" style={INPUT_STYLE} />
          </Field>
          <Field label="Ciudad Principal" value={form.ciudad_principal} edit={edit}>
            <input type="text" value={form.ciudad_principal ?? ""} onChange={e => set("ciudad_principal", e.target.value)} placeholder="Ej: Bogotá" style={INPUT_STYLE} />
          </Field>
          <Field label="Dirección" value={form.direccion} edit={edit}>
            <input type="text" value={form.direccion ?? ""} onChange={e => set("direccion", e.target.value)} placeholder="Dirección principal" style={INPUT_STYLE} />
          </Field>
          <Field label="Teléfono" value={form.telefono} edit={edit}>
            <input type="tel" value={form.telefono ?? ""} onChange={e => set("telefono", e.target.value)} placeholder="(601) 000-0000" style={INPUT_STYLE} />
          </Field>
          <Field label="Email Principal" value={form.email_principal} edit={edit}>
            <input type="email" value={form.email_principal ?? ""} onChange={e => set("email_principal", e.target.value)} placeholder="contacto@empresa.com" style={INPUT_STYLE} />
          </Field>
          <Field label="Sitio Web" value={form.pagina_web} edit={edit}>
            <input type="url" value={form.pagina_web ?? ""} onChange={e => set("pagina_web", e.target.value)} placeholder="https://empresa.com" style={INPUT_STYLE} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Descripción / Notas" value={form.descripcion} edit={edit}>
              <textarea
                value={form.descripcion ?? ""}
                onChange={e => set("descripcion", e.target.value)}
                placeholder="Información relevante sobre el cliente…"
                rows={3}
                style={{ ...INPUT_STYLE, resize: "vertical" }}
              />
            </Field>
          </div>
        </Section>

        {/* Controles de creación */}
        {esNuevo && (
          <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--gray-100)" }}>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--gray-400)" }}>
              <span style={{ color: "var(--inlop-red)" }}>*</span> La Razón Social es obligatoria.
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1.5" style={{ fontSize: "var(--text-sm)", color: "#16A34A" }}>
                  <CheckCircle className="w-4 h-4" />
                  Guardado
                </span>
              )}
              <Button
                variant="primary"
                size="md"
                icon={<Save className="w-4 h-4" />}
                loading={saving}
                disabled={!form.razon_social.trim()}
                onClick={handleGuardar}
              >
                Crear Cliente
              </Button>
            </div>
          </div>
        )}

        {errorGuardar && (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--inlop-red)",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            {errorGuardar}
          </div>
        )}
      </div>
    </div>
  );
}
