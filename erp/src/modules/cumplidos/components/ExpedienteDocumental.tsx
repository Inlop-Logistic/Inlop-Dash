import { useRef } from "react";
import {
  Upload, Eye, Download, Trash2, MessageCircle,
  FileText, CheckCircle2, Clock, AlertCircle, Loader2,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { CumplidoRecord, DocumentoArchivo, TipoDocumento } from "../types";
import { useDocumentosCumplido } from "../hooks/useDocumentosCumplido";

// ─── Configuración de tipos de documento ──────────────────────────────────────

interface TipoConfig {
  id:        TipoDocumento;
  label:     string;
  requerido: boolean;
}

const TIPOS_BASE: TipoConfig[] = [
  { id: "remesa",     label: "Remesa",                  requerido: true  },
  { id: "cumplido",   label: "Cumplido",                requerido: true  },
  { id: "manifiesto", label: "Manifiesto",              requerido: true  },
  { id: "evidencias", label: "Evidencias fotográficas", requerido: false },
  { id: "tiquete",    label: "Tiquete báscula",         requerido: false },
];
const TIPO_GUT: TipoConfig = { id: "gut", label: "GUT", requerido: true };

function tiposParaViaje(typeOperation: string | null): TipoConfig[] {
  const esGranel = (typeOperation ?? "").trim().toLowerCase() === "granel liquido";
  return esGranel ? [...TIPOS_BASE, TIPO_GUT] : TIPOS_BASE;
}

function archivoParaTipo(
  archivos: DocumentoArchivo[],
  tipo: TipoDocumento,
): DocumentoArchivo | null {
  return archivos.find((a) => a.nombre.startsWith(`${tipo}_`)) ?? null;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1_048_576)   return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Sub-componente: un tipo de documento ─────────────────────────────────────

interface DocumentoItemProps {
  tipo:        TipoConfig;
  archivo:     DocumentoArchivo | null;
  uploading:   boolean;
  hasTel:      boolean;
  onSubir:     (file: File) => void;
  onVer:       () => void;
  onDescargar: () => void;
  onEliminar:  () => void;
  onWhatsApp:  () => void;
}

function DocumentoItem({
  tipo, archivo, uploading,
  hasTel, onSubir, onVer, onDescargar, onEliminar, onWhatsApp,
}: DocumentoItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cargado  = archivo !== null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1.5px solid ${cargado ? "#A7F3D0" : tipo.requerido ? "var(--gray-200)" : "var(--gray-100)"}`,
        background: cargado ? "#F0FDF4" : "#fff",
      }}
    >
      {/* Fila de cabecera */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: cargado ? "#059669" : tipo.requerido ? "var(--navy)" : "var(--gray-400)" }}
          />
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: cargado ? "#065F46" : tipo.requerido ? "var(--gray-700)" : "var(--gray-500)" }}
          >
            {tipo.label}
          </span>
          {tipo.requerido && !cargado && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: "#FEE2E2", color: "#DC2626" }}
            >
              REQ
            </span>
          )}
        </div>
        {cargado ? (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "#D1FAE5", color: "#059669" }}
          >
            <CheckCircle2 className="w-2.5 h-2.5" />
            CARGADO
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold shrink-0"
            style={{ color: tipo.requerido ? "#D97706" : "var(--gray-400)" }}
          >
            {tipo.requerido
              ? <><AlertCircle className="w-3 h-3" /> Pendiente</>
              : <><Clock className="w-3 h-3" /> Opcional</>
            }
          </span>
        )}
      </div>

      {/* Meta del archivo o acciones de carga */}
      <div
        className="px-3 pb-2.5 flex items-center justify-between gap-2 flex-wrap"
        style={{ borderTop: `1px solid ${cargado ? "#BBF7D0" : "var(--gray-100)"}` }}
      >
        {cargado && archivo ? (
          <>
            <div className="min-w-0">
              <p className="text-[11px] truncate font-mono" style={{ color: "#065F46" }}>
                {archivo.nombre}
              </p>
              <p className="text-[10px]" style={{ color: "var(--gray-400)" }}>
                {fmtSize(archivo.size)}{archivo.created_at ? ` · ${fmtFecha(archivo.created_at)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ActionBtn icon={<Eye className="w-3 h-3" />}         label="Ver"         onClick={onVer}       />
              <ActionBtn icon={<Download className="w-3 h-3" />}    label="Descargar"   onClick={onDescargar} />
              {hasTel && (
                <ActionBtn icon={<MessageCircle className="w-3 h-3" />} label="WhatsApp" onClick={onWhatsApp} green />
              )}
              <ActionBtn icon={<Trash2 className="w-3 h-3" />}      label="Eliminar"    onClick={onEliminar}  danger />
              {/* input oculto para reemplazar */}
              <label style={{ cursor: "pointer" }} title="Reemplazar documento">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f); e.target.value = ""; }}
                />
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{ background: "var(--gray-100)", color: "var(--gray-500)", cursor: "pointer" }}
                >
                  <Upload className="w-3 h-3" />
                  Reemplazar
                </span>
              </label>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            {uploading ? (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--navy)" }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Subiendo…
              </span>
            ) : (
              <label style={{ cursor: "pointer" }}>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f); e.target.value = ""; }}
                />
                <span
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--navy)", color: "#fff", cursor: "pointer" }}
                >
                  <Upload className="w-3 h-3" />
                  Cargar documento
                </span>
              </label>
            )}
            {hasTel && !uploading && (
              <button
                type="button"
                onClick={onWhatsApp}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "#D1FAE5", color: "#065F46", cursor: "pointer" }}
              >
                <MessageCircle className="w-3 h-3" />
                Solicitar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, green = false, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  green?: boolean;
  danger?: boolean;
}) {
  const bg    = danger ? "#FFF1F2" : green ? "#D1FAE5" : "var(--gray-100)";
  const color = danger ? "#DC2626" : green ? "#065F46" : "var(--gray-600)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
      style={{ background: bg, color, cursor: "pointer" }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface ExpedienteDocumentalProps {
  cumplido: CumplidoRecord;
}

export function ExpedienteDocumental({ cumplido }: ExpedienteDocumentalProps) {
  const { archivos, cargando, error, uploading, subir, eliminar, abrirUrl, solicitarWhatsApp } =
    useDocumentosCumplido(cumplido.trip_number);

  const tipos  = tiposParaViaje(cumplido.type_operation);
  const hasTel = !!cumplido.conductor_tel;

  const cargados   = tipos.filter((t) => archivoParaTipo(archivos, t.id) !== null).length;
  const requeridos = tipos.filter((t) => t.requerido).length;
  const cargadosReq = tipos
    .filter((t) => t.requerido && archivoParaTipo(archivos, t.id) !== null)
    .length;
  const completo = cargadosReq === requeridos;

  return (
    <PanelSection
      title="Expediente documental"
      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
    >
      {/* Barra de progreso */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
        style={{
          background: completo ? "#D1FAE5" : "#FEF3C7",
          border: `1px solid ${completo ? "#A7F3D0" : "#FDE68A"}`,
        }}
      >
        <span
          className="text-[12px] font-semibold"
          style={{ color: completo ? "#065F46" : "#92400E" }}
        >
          {completo
            ? "Documentación requerida completa"
            : `${requeridos - cargadosReq} documento${requeridos - cargadosReq !== 1 ? "s" : ""} requerido${requeridos - cargadosReq !== 1 ? "s" : ""} pendiente${requeridos - cargadosReq !== 1 ? "s" : ""}`}
        </span>
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: completo ? "#059669" : "#B45309" }}
        >
          {cargados}/{tipos.length}
        </span>
      </div>

      {/* Lista de tipos */}
      {cargando ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--gray-400)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Cargando expediente…</span>
        </div>
      ) : error ? (
        <div
          className="text-[12px] px-3 py-2 rounded-xl"
          style={{ background: "#FFF1F2", color: "#DC2626" }}
        >
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tipos.map((tipo) => {
            const archivo = archivoParaTipo(archivos, tipo.id);
            return (
              <DocumentoItem
                key={tipo.id}
                tipo={tipo}
                archivo={archivo}
                uploading={uploading === tipo.id}
                hasTel={hasTel}
                onSubir={(file) => subir(tipo.id, cumplido.license_plate ?? "SIN", file)}
                onVer={() => archivo && abrirUrl(archivo.nombre, false)}
                onDescargar={() => archivo && abrirUrl(archivo.nombre, true)}
                onEliminar={() => archivo && eliminar(archivo.nombre)}
                onWhatsApp={() =>
                  solicitarWhatsApp(cumplido.conductor_tel ?? "", cumplido.driver_name ?? "conductor")
                }
              />
            );
          })}
        </div>
      )}

      {cumplido.obs && (
        <div
          className="mt-3 text-[12px] px-3 py-2.5 rounded-xl"
          style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", lineHeight: 1.5 }}
        >
          <span className="font-semibold">Obs. TorreControl: </span>{cumplido.obs}
        </div>
      )}
    </PanelSection>
  );
}
