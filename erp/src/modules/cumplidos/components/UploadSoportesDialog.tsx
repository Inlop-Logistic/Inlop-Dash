import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

function fmtSize(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

interface Progreso {
  completados: number;
  total:       number;
  fallidos:    string[];
}

interface UploadSoportesDialogProps {
  open:      boolean;
  onClose:   () => void;
  onSubmit:  (files: File[], descripcion: string) => Promise<boolean>;
  progreso:  Progreso | null;
}

export function UploadSoportesDialog({ open, onClose, onSubmit, progreso }: UploadSoportesDialogProps) {
  const [files,       setFiles]       = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const subiendo = progreso !== null;

  function agregarArchivos(nuevos: FileList | null) {
    if (!nuevos) return;
    setFiles((prev) => [...prev, ...Array.from(nuevos)]);
  }

  function quitarArchivo(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function cerrarYLimpiar() {
    setFiles([]);
    setDescripcion("");
    onClose();
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    const ok = await onSubmit(files, descripcion);
    if (ok) cerrarYLimpiar();
    else setFiles([]); // limpia selección; el error queda visible en el panel
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,42,107,0.35)", backdropFilter: "blur(2px)" }}
      onClick={subiendo ? undefined : cerrarYLimpiar}
    >
      <div
        className="w-full flex flex-col bg-white rounded-2xl overflow-hidden"
        style={{ maxWidth: "440px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--gray-100)" }}>
          <span className="font-bold text-[15px]" style={{ color: "var(--navy)" }}>Cargar soportes</span>
          {!subiendo && (
            <button onClick={cerrarYLimpiar} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Cerrar">
              <X className="w-4 h-4" style={{ color: "var(--gray-500)" }} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {subiendo ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--navy)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--gray-700)" }}>
                Subiendo {progreso!.completados}/{progreso!.total}…
              </span>
            </div>
          ) : (
            <>
              {/* Selector de archivos */}
              <label
                className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer transition-colors"
                style={{ border: "1.5px dashed var(--gray-200)", background: "var(--gray-50)" }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ""; }}
                />
                <Upload className="w-5 h-5" style={{ color: "var(--gray-400)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--gray-500)" }}>
                  Seleccionar uno o varios archivos
                </span>
                <span className="text-[10px]" style={{ color: "var(--gray-400)" }}>
                  PDF, JPG, PNG, WEBP · máx. 20 MB c/u
                </span>
              </label>

              {/* Archivos seleccionados */}
              {files.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: "var(--gray-50)", border: "1px solid var(--gray-100)" }}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--gray-400)" }} />
                      <span className="text-[12px] truncate flex-1" style={{ color: "var(--gray-700)" }}>{f.name}</span>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--gray-400)" }}>{fmtSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => quitarArchivo(idx)}
                        className="shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors"
                        aria-label={`Quitar ${f.name}`}
                      >
                        <X className="w-3 h-3" style={{ color: "var(--gray-400)" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Descripción opcional */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold" style={{ color: "var(--gray-500)" }}>
                  Descripción <span style={{ color: "var(--gray-300)" }}>(opcional)</span>
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Remesa cliente, evidencias de entrega…"
                  rows={2}
                  className="text-[13px] px-3 py-2 rounded-lg outline-none resize-none"
                  style={{ border: "1.5px solid var(--gray-200)", color: "var(--gray-700)" }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!subiendo && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: "1px solid var(--gray-100)" }}>
            <button
              type="button"
              onClick={cerrarYLimpiar}
              className="text-[12px] font-semibold px-3.5 py-2 rounded-lg transition-colors"
              style={{ color: "var(--gray-500)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={files.length === 0}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              Cargar{files.length > 0 ? ` (${files.length})` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
