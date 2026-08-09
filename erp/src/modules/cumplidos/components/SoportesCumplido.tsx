import { useRef, useState } from "react";
import {
  Upload, Eye, Download, Trash2, MessageCircle, RefreshCw,
  FileText, CheckCircle2, Loader2, AlertCircle,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { CumplidoRecord } from "../types";
import { useSoportesCumplido } from "../hooks/useSoportesCumplido";
import { tiposDocumentoParaViaje } from "../constants";
import { UploadSoportesDialog } from "./UploadSoportesDialog";

const ACCEPT_REEMPLAZO = ".pdf,.jpg,.jpeg,.png,.webp";

function fmtSize(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
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

// ─── Fila de un soporte ──────────────────────────────────────────────────────

interface SoporteRowProps {
  nombre:       string;
  nombreOriginal: string;
  tipoLabel:    string | null;
  size:         number;
  fecha:        string | null;
  usuario:      string | null;
  reemplazando: boolean;
  eliminando:   boolean;
  onVer:        () => void;
  onDescargar:  () => void;
  onReemplazar: () => void;
  onEliminar:   () => void;
}

function SoporteRow({
  nombre, nombreOriginal, tipoLabel, size, fecha, usuario,
  reemplazando, eliminando, onVer, onDescargar, onReemplazar, onEliminar,
}: SoporteRowProps) {
  const ocupado = reemplazando || eliminando;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1.5px solid var(--gray-200)", background: "#fff", opacity: ocupado ? 0.6 : 1 }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 gap-2 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--navy)" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold truncate font-mono" style={{ color: "var(--gray-800)" }} title={nombre}>
                {nombre}
              </span>
              {tipoLabel && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "#DBEAFE", color: "#1D4ED8" }}
                >
                  {tipoLabel.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--gray-400)" }}>
              {fmtSize(size)}{fecha ? ` · ${fmtFecha(fecha)}` : ""}{usuario ? ` · ${usuario}` : ""}
            </p>
            {nombreOriginal && nombreOriginal !== nombre && (
              <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--gray-300)" }} title={nombreOriginal}>
                Original: {nombreOriginal}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {ocupado ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1" style={{ color: "var(--gray-400)" }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              {reemplazando ? "Reemplazando…" : "Eliminando…"}
            </span>
          ) : (
            <>
              <ActionBtn icon={<Eye className="w-3 h-3" />}      label="Ver"         onClick={onVer} />
              <ActionBtn icon={<Download className="w-3 h-3" />} label="Descargar"   onClick={onDescargar} />
              <ActionBtn icon={<RefreshCw className="w-3 h-3" />} label="Reemplazar" onClick={onReemplazar} />
              <ActionBtn icon={<Trash2 className="w-3 h-3" />}   label="Eliminar"    onClick={onEliminar} danger />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, danger = false,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
      style={{
        background: danger ? "#FFF1F2" : "var(--gray-100)",
        color:      danger ? "#DC2626" : "var(--gray-600)",
        cursor:     "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface SoportesCumplidoProps {
  cumplido: CumplidoRecord;
}

export function SoportesCumplido({ cumplido }: SoportesCumplidoProps) {
  const {
    soportes, cargando, error, progreso,
    reemplazandoId, eliminandoId,
    subirVarios, reemplazar, eliminar, abrirUrl, solicitarWhatsApp,
  } = useSoportesCumplido(cumplido.trip_number, cumplido.license_plate);

  const [dialogOpen, setDialogOpen] = useState(false);
  const reemplazoTargetId = useRef<string | null>(null);
  const reemplazoInputRef = useRef<HTMLInputElement>(null);

  const tipos       = tiposDocumentoParaViaje(cumplido.type_operation);
  const hasTel      = !!cumplido.conductor_tel;
  const tiposCargados = new Set(soportes.map((s) => s.tipo_documento).filter(Boolean));
  const requeridos     = tipos.filter((t) => t.requerido).length;
  const requeridosOk   = tipos.filter((t) => t.requerido && tiposCargados.has(t.id)).length;
  const completo       = requeridos === 0 || requeridosOk === requeridos;

  function iniciarReemplazo(id: string) {
    reemplazoTargetId.current = id;
    reemplazoInputRef.current?.click();
  }

  function handleReemplazoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id   = reemplazoTargetId.current;
    e.target.value = "";
    if (file && id) reemplazar(id, file);
  }

  function handleEliminar(id: string, nombre: string) {
    if (window.confirm(`¿Eliminar el soporte "${nombre}"? Esta acción no se puede deshacer.`)) {
      eliminar(id);
    }
  }

  return (
    <PanelSection
      title="Soportes de Cumplido"
      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
    >
      {/* input oculto compartido para "Reemplazar" */}
      <input
        ref={reemplazoInputRef}
        type="file"
        accept={ACCEPT_REEMPLAZO}
        className="hidden"
        onChange={handleReemplazoSeleccionado}
      />

      {/* Barra de progreso */}
      {requeridos > 0 && (
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
          style={{
            background: completo ? "#D1FAE5" : "#FEF3C7",
            border: `1px solid ${completo ? "#A7F3D0" : "#FDE68A"}`,
          }}
        >
          <span className="text-[12px] font-semibold" style={{ color: completo ? "#065F46" : "#92400E" }}>
            {completo
              ? "Documentación requerida completa"
              : `${requeridos - requeridosOk} tipo${requeridos - requeridosOk !== 1 ? "s" : ""} requerido${requeridos - requeridosOk !== 1 ? "s" : ""} sin soporte`}
          </span>
          <span className="text-[11px] font-mono font-bold" style={{ color: completo ? "#059669" : "#B45309" }}>
            {requeridosOk}/{requeridos}
          </span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--navy)", color: "#fff", cursor: "pointer" }}
        >
          <Upload className="w-3 h-3" />
          Cargar Soportes
        </button>
        {hasTel && (
          <button
            type="button"
            onClick={() => solicitarWhatsApp(cumplido.conductor_tel ?? "", cumplido.driver_name ?? "conductor")}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "#D1FAE5", color: "#065F46", cursor: "pointer" }}
          >
            <MessageCircle className="w-3 h-3" />
            Solicitar por WhatsApp
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2 text-[12px] px-3 py-2 rounded-xl mb-3"
          style={{ background: "#FFF1F2", color: "#DC2626" }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--gray-400)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Cargando soportes…</span>
        </div>
      ) : soportes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
          <FileText className="w-5 h-5" style={{ color: "var(--gray-300)" }} />
          <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
            Aún no se han cargado soportes para este viaje.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {soportes.map((s) => (
            <SoporteRow
              key={s.id}
              nombre={s.nombre_generado}
              nombreOriginal={s.nombre_original}
              tipoLabel={tipos.find((t) => t.id === s.tipo_documento)?.label ?? null}
              size={s.tamano_bytes}
              fecha={s.creado_en}
              usuario={s.usuario}
              reemplazando={reemplazandoId === s.id}
              eliminando={eliminandoId === s.id}
              onVer={() => abrirUrl(s.id, false)}
              onDescargar={() => abrirUrl(s.id, true)}
              onReemplazar={() => iniciarReemplazo(s.id)}
              onEliminar={() => handleEliminar(s.id, s.nombre_generado)}
            />
          ))}
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

      <UploadSoportesDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={subirVarios}
        progreso={progreso}
      />
    </PanelSection>
  );
}
