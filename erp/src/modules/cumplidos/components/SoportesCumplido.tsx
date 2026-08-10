import { useRef, useState, useEffect } from "react";
import {
  Upload, Eye, Download, Trash2, MessageCircle,
  RefreshCw, FileText, Loader2, AlertCircle,
  MoreHorizontal, Paperclip,
} from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { CumplidoRecord } from "../types";
import { useSoportesCumplido } from "../hooks/useSoportesCumplido";
import { tiposDocumentoParaViaje } from "../constants";
import { UploadSoportesDialog } from "./UploadSoportesDialog";

const ACCEPT_REEMPLAZO = ".pdf,.jpg,.jpeg,.png,.webp";
const CAP_SOPORTES     = 7;
const MAX_VISIBLE_INIT = 3;

function fmtSize(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ─── Menú ••• por soporte ─────────────────────────────────────────────────────

interface MasMenuProps {
  onDescargar:  () => void;
  onReemplazar: () => void;
  onEliminar:   () => void;
}

function MasMenu({ onDescargar, onReemplazar, onEliminar }: MasMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const OPCIONES = [
    {
      icon:   <Download  className="w-3 h-3" />,
      label:  "Descargar",
      danger: false,
      action: () => { setOpen(false); onDescargar(); },
    },
    {
      icon:   <RefreshCw className="w-3 h-3" />,
      label:  "Reemplazar",
      danger: false,
      action: () => { setOpen(false); onReemplazar(); },
    },
    {
      icon:   <Trash2    className="w-3 h-3" />,
      label:  "Eliminar",
      danger: true,
      action: () => { setOpen(false); onEliminar(); },
    },
  ];

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Más acciones"
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        style={{
          background: open ? "var(--gray-200)" : "var(--gray-100)",
          color:      "var(--gray-500)",
          cursor:     "pointer",
        }}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 overflow-hidden"
          style={{
            top:          "calc(100% + 4px)",
            minWidth:     148,
            background:   "#fff",
            border:       "1px solid var(--gray-200)",
            borderRadius: 10,
            boxShadow:    "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {OPCIONES.map(({ icon, label, danger, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium transition-colors hover:opacity-80"
              style={{
                color:      danger ? "#DC2626" : "var(--gray-700)",
                background: "transparent",
                cursor:     "pointer",
              }}
            >
              <span style={{ color: danger ? "#DC2626" : "var(--gray-400)" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fila compacta de un soporte ──────────────────────────────────────────────

interface SoporteRowProps {
  tipoLabel:    string;
  size:         number;
  reemplazando: boolean;
  eliminando:   boolean;
  onVer:        () => void;
  onDescargar:  () => void;
  onReemplazar: () => void;
  onEliminar:   () => void;
}

function SoporteRow({
  tipoLabel, size, reemplazando, eliminando,
  onVer, onDescargar, onReemplazar, onEliminar,
}: SoporteRowProps) {
  const ocupado = reemplazando || eliminando;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{
        borderRadius: 10,
        border:       "1px solid var(--gray-200)",
        background:   "#fff",
        opacity:      ocupado ? 0.6 : 1,
        transition:   "opacity 0.15s",
      }}
    >
      <FileText
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: "var(--navy)" }}
      />

      {/* Tipo + tamaño */}
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span
          className="text-[12px] font-semibold uppercase tracking-wide truncate"
          style={{ color: "var(--gray-800)" }}
        >
          {tipoLabel}
        </span>
        <span
          className="text-[10px] shrink-0 tabular-nums"
          style={{ color: "var(--gray-400)" }}
        >
          {fmtSize(size)}
        </span>
      </div>

      {/* Acciones */}
      {ocupado ? (
        <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: "var(--gray-400)" }}>
          <Loader2 className="w-3 h-3 animate-spin" />
          {reemplazando ? "Reemplazando…" : "Eliminando…"}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={onVer}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-colors"
            style={{ background: "var(--gray-100)", color: "var(--gray-600)", cursor: "pointer" }}
          >
            <Eye className="w-3 h-3" />
            Ver
          </button>
          <MasMenu
            onDescargar={onDescargar}
            onReemplazar={onReemplazar}
            onEliminar={onEliminar}
          />
        </>
      )}
    </div>
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
  const [expandido,  setExpandido]  = useState(false);
  const reemplazoTargetId = useRef<string | null>(null);
  const reemplazoInputRef = useRef<HTMLInputElement>(null);

  const tipos     = tiposDocumentoParaViaje(cumplido.type_operation);
  const hasTel    = !!cumplido.conductor_tel;
  const total     = soportes.length;
  const lleno     = total >= CAP_SOPORTES;
  const restantes = total - MAX_VISIBLE_INIT;

  // Primeros MAX_VISIBLE_INIT, o todos si expandido
  const soportesVisibles =
    expandido || total <= MAX_VISIBLE_INIT
      ? soportes
      : soportes.slice(0, MAX_VISIBLE_INIT);

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

  function getTipoLabel(tipoId: string | null): string {
    if (!tipoId) return "Soporte";
    return tipos.find((t) => t.id === tipoId)?.label ?? tipoId.toUpperCase();
  }

  function handleEliminar(id: string, tipoLabel: string) {
    if (window.confirm(`¿Eliminar el soporte "${tipoLabel}"? Esta acción no se puede deshacer.`)) {
      eliminar(id);
    }
  }

  return (
    <PanelSection>
      {/* input oculto compartido para Reemplazar */}
      <input
        ref={reemplazoInputRef}
        type="file"
        accept={ACCEPT_REEMPLAZO}
        className="hidden"
        onChange={handleReemplazoSeleccionado}
      />

      {/* ── Encabezado: título + contador ────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "var(--gray-400)" }}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--gray-400)" }}
          >
            Soportes de Cumplido
          </span>
        </div>

        {!cargando && (
          <span
            className="text-[11px] font-bold tabular-nums"
            title={`${total} de ${CAP_SOPORTES} soportes cargados`}
            style={{ color: lleno ? "var(--inlop-red, #C0392B)" : "var(--gray-500)" }}
          >
            {total}/{CAP_SOPORTES}
          </span>
        )}
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          disabled={lleno}
          onClick={() => !lleno && setDialogOpen(true)}
          title={lleno ? `Límite de ${CAP_SOPORTES} soportes alcanzado` : undefined}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: lleno ? "var(--gray-100)" : "var(--navy)",
            color:      lleno ? "var(--gray-400)" : "#fff",
            cursor:     lleno ? "not-allowed" : "pointer",
          }}
        >
          <Upload className="w-3 h-3" />
          {lleno ? "Límite alcanzado" : "Cargar"}
        </button>

        {hasTel && (
          <button
            type="button"
            onClick={() =>
              solicitarWhatsApp(
                cumplido.conductor_tel ?? "",
                cumplido.driver_name   ?? "conductor",
              )
            }
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "#D1FAE5", color: "#065F46", cursor: "pointer" }}
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </button>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-2 text-[12px] px-3 py-2 rounded-xl mb-3"
          style={{ background: "#FFF1F2", color: "#DC2626" }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {cargando ? (
        <div
          className="flex items-center justify-center py-6 gap-2"
          style={{ color: "var(--gray-400)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Cargando soportes…</span>
        </div>
      ) : soportes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
          <FileText className="w-5 h-5" style={{ color: "var(--gray-300)" }} />
          <span className="text-[12px]" style={{ color: "var(--gray-400)" }}>
            Aún no se han cargado soportes para este viaje.
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {soportesVisibles.map((s) => {
              const label = getTipoLabel(s.tipo_documento);
              return (
                <SoporteRow
                  key={s.id}
                  tipoLabel={label}
                  size={s.tamano_bytes}
                  reemplazando={reemplazandoId === s.id}
                  eliminando={eliminandoId === s.id}
                  onVer={()         => abrirUrl(s.id, false)}
                  onDescargar={()   => abrirUrl(s.id, true)}
                  onReemplazar={()  => iniciarReemplazo(s.id)}
                  onEliminar={()    => handleEliminar(s.id, label)}
                />
              );
            })}
          </div>

          {/* Ver / ocultar restantes */}
          {!expandido && restantes > 0 && (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="w-full mt-2 text-[11px] font-semibold text-right transition-colors"
              style={{ color: "var(--navy)", cursor: "pointer", background: "transparent" }}
            >
              Ver los {restantes} restante{restantes !== 1 ? "s" : ""} →
            </button>
          )}
          {expandido && total > MAX_VISIBLE_INIT && (
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="w-full mt-2 text-[11px] font-semibold text-right transition-colors"
              style={{ color: "var(--gray-400)", cursor: "pointer", background: "transparent" }}
            >
              Mostrar menos
            </button>
          )}
        </>
      )}

      {/* ── Observación TorreControl ─────────────────────────────────────── */}
      {cumplido.obs && (
        <div
          className="mt-3 text-[12px] px-3 py-2.5 rounded-xl"
          style={{
            background:  "#FEF3C7",
            color:       "#92400E",
            border:      "1px solid #FDE68A",
            lineHeight:  1.5,
          }}
        >
          <span className="font-semibold">Obs. TorreControl: </span>
          {cumplido.obs}
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
