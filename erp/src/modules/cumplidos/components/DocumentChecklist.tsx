import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { PanelSection } from "@/components/ui";
import type { DocumentoCheck } from "../types";

interface DocumentChecklistProps {
  documentos: DocumentoCheck[];
}

function CheckRow({ doc }: { doc: DocumentoCheck }) {
  const { presente, requerido, label } = doc;

  const icon = presente
    ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
    : requerido
      ? <XCircle className="w-4 h-4 shrink-0" style={{ color: "#DC2626" }} />
      : <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--gray-300)" }} />;

  const color = presente
    ? "var(--gray-700)"
    : requerido
      ? "#9F1239"
      : "var(--gray-400)";

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--gray-100)" }}>
      <span className="flex items-center gap-2.5 text-[13px]" style={{ color }}>
        {icon}
        {label}
      </span>
      {requerido && !presente && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: "#FEE2E2", color: "#DC2626" }}
        >
          REQUERIDO
        </span>
      )}
      {presente && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: "#D1FAE5", color: "#059669" }}
        >
          OK
        </span>
      )}
    </div>
  );
}

export function DocumentChecklist({ documentos }: DocumentChecklistProps) {
  const presentes   = documentos.filter(d => d.presente).length;
  const requeridos  = documentos.filter(d => d.requerido).length;
  const faltanReq   = documentos.filter(d => d.requerido && !d.presente).length;

  return (
    <PanelSection title="Checklist documental" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
      {/* Resumen */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
        style={{
          background: faltanReq > 0 ? "#FEF3C7" : "#D1FAE5",
          border: `1px solid ${faltanReq > 0 ? "#FDE68A" : "#A7F3D0"}`,
        }}
      >
        <span className="text-[12px] font-semibold" style={{ color: faltanReq > 0 ? "#92400E" : "#065F46" }}>
          {faltanReq > 0
            ? `${faltanReq} documento${faltanReq > 1 ? "s" : ""} requerido${faltanReq > 1 ? "s" : ""} pendiente${faltanReq > 1 ? "s" : ""}`
            : "Documentos requeridos completos"}
        </span>
        <span className="text-[11px] font-mono" style={{ color: faltanReq > 0 ? "#B45309" : "#059669" }}>
          {presentes}/{requeridos} req.
        </span>
      </div>

      {/* Lista */}
      <div className="px-1">
        {documentos.map(doc => <CheckRow key={doc.id} doc={doc} />)}
      </div>

      {/* Nota FASE 1 */}
      <div
        className="mt-3 text-[11px] px-3 py-2 rounded-xl"
        style={{ background: "var(--gray-50)", color: "var(--gray-400)", border: "1px solid var(--gray-100)" }}
      >
        Carga y validación de documentos disponibles próximamente
      </div>
    </PanelSection>
  );
}
