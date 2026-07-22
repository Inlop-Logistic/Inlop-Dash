import { useMemo, useState } from "react";
import { GitMerge, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ClienteListItem } from "../types";
import { ModalFusionarCliente } from "./ModalFusionarCliente";

interface PotentialDuplicate {
  a:    ClienteListItem;
  b:    ClienteListItem;
  score: number;
  tipo:  "prefijo" | "palabras";
}

function normClient(raw: string): string {
  return String(raw).toUpperCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDuplicates(clientes: ClienteListItem[]): PotentialDuplicate[] {
  const elegibles = clientes.filter(c => c.estado !== "fusionado" && c.estado !== "inactivo");
  const enriched  = elegibles.map(c => {
    const norm  = normClient(c.razon_social);
    const words = new Set(norm.split(" ").filter(w => w.length >= 3));
    return { c, norm, words };
  });

  const pairs: PotentialDuplicate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const A = enriched[i];
      const B = enriched[j];
      const key = [A.c.id, B.c.id].sort().join("|");
      if (seen.has(key)) continue;

      const shorter = A.norm.length <= B.norm.length ? A : B;
      const longer  = A.norm.length >  B.norm.length ? A : B;

      if (shorter.norm.length >= 6 && longer.norm.startsWith(shorter.norm)) {
        seen.add(key);
        pairs.push({ a: shorter.c, b: longer.c, score: 1.0, tipo: "prefijo" });
        continue;
      }

      if (A.words.size < 2 || B.words.size < 2) continue;
      let inter = 0;
      A.words.forEach(w => { if (B.words.has(w)) inter++; });
      const union   = new Set([...A.words, ...B.words]).size;
      const jaccard = union > 0 ? inter / union : 0;
      if (jaccard >= 0.65) {
        seen.add(key);
        pairs.push({ a: A.c, b: B.c, score: jaccard, tipo: "palabras" });
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score).slice(0, 60);
}

interface TabDuplicadosProps {
  clientes:        ClienteListItem[];
  onOpenWorkspace: (id: string) => void;
  onRefresh:       () => void;
}

export function TabDuplicados({ clientes, onOpenWorkspace, onRefresh }: TabDuplicadosProps) {
  const duplicados = useMemo(() => detectDuplicates(clientes), [clientes]);

  const [mergeModal, setMergeModal] = useState<{
    oficial:   ClienteListItem;
    duplicado: ClienteListItem;
  } | null>(null);

  const [resueltos, setResueltos] = useState<Set<string>>(new Set());

  function pairKey(a: ClienteListItem, b: ClienteListItem) {
    return [a.id, b.id].sort().join("|");
  }

  const pendientes = duplicados.filter(d => !resueltos.has(pairKey(d.a, d.b)));

  return (
    <div style={{ padding: "0 24px 32px" }}>

      {/* Banner */}
      <div
        style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "14px 16px", borderRadius: 10,
          background: "#FFFBEB", border: "1px solid #FDE68A",
          marginBottom: 20,
        }}
      >
        <AlertTriangle style={{ width: 15, height: 15, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: "var(--text-sm)", color: "#92400E", lineHeight: 1.6 }}>
          {pendientes.length > 0
            ? <>Se detectaron <strong>{pendientes.length}</strong> posible{pendientes.length !== 1 ? "s" : ""} duplicado{pendientes.length !== 1 ? "s" : ""}.
                La detección compara nombres normalizados y similitud de palabras. Revisa cada par antes de fusionar.</>
            : <>No se detectaron duplicados entre los clientes activos y prospectos.</>
          }
        </div>
      </div>

      {/* Lista vacía */}
      {pendientes.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--gray-400)" }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "#059669", margin: "0 auto 12px" }} />
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--gray-700)" }}>
            Todo limpio
          </div>
          <div style={{ fontSize: "var(--text-sm)", marginTop: 4 }}>
            No hay posibles duplicados en este momento.
          </div>
        </div>
      )}

      {/* Filas de pares */}
      {pendientes.map(({ a, b, score, tipo }) => (
        <div
          key={pairKey(a, b)}
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr auto",
            gap: 12, alignItems: "center",
            padding: "14px 16px", marginBottom: 8,
            borderRadius: 10, border: "1px solid var(--gray-200)",
            background: "#fff",
          }}
        >
          {/* Cliente A */}
          <ClienteCard cliente={a} onOpen={() => onOpenWorkspace(a.id)} />

          {/* Cliente B */}
          <ClienteCard cliente={b} onOpen={() => onOpenWorkspace(b.id)} />

          {/* Acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <Chip tipo={tipo} score={score} />
            <button
              onClick={() => setMergeModal({ oficial: a, duplicado: b })}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 7, border: "none",
                background: "var(--navy)", color: "#fff",
                fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <GitMerge style={{ width: 12, height: 12 }} />
              Fusionar
            </button>
            <button
              onClick={() => setResueltos(prev => new Set([...prev, pairKey(a, b)]))}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 7,
                border: "1px solid var(--gray-200)", background: "#fff",
                fontSize: "var(--text-xs)", color: "var(--gray-500)", cursor: "pointer",
              }}
            >
              Ignorar
            </button>
          </div>
        </div>
      ))}

      {/* Modal de fusión */}
      {mergeModal && (
        <ModalFusionarCliente
          clienteOficial={mergeModal.oficial}
          onClose={() => setMergeModal(null)}
          onSuccess={(id) => {
            setResueltos(prev => new Set([...prev, pairKey(mergeModal.oficial, mergeModal.duplicado)]));
            setMergeModal(null);
            onRefresh();
            onOpenWorkspace(id);
          }}
        />
      )}
    </div>
  );
}

function ClienteCard({ cliente, onOpen }: { cliente: ClienteListItem; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        padding: "10px 12px", borderRadius: 8, border: "1px solid var(--gray-100)",
        background: "var(--gray-50)", cursor: "pointer",
        transition: "border-color .12s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--gray-300)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--gray-100)")}
    >
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gray-800)", marginBottom: 2 }}>
        {cliente.razon_social}
      </div>
      <div style={{ fontSize: "11px", color: "var(--gray-400)", fontFamily: "monospace" }}>
        {[cliente.codigo_cliente, cliente.nit ? `NIT ${cliente.nit}` : null, cliente.estado]
          .filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

function Chip({ tipo, score }: { tipo: "prefijo" | "palabras"; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      style={{
        fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: 8,
        background: score >= 0.9 ? "#FEE2E2" : "#FEF3C7",
        color:      score >= 0.9 ? "#991B1B" : "#92400E",
      }}
    >
      {tipo === "prefijo" ? "Prefijo exacto" : `${pct}% similitud`}
    </span>
  );
}
