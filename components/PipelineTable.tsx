"use client";
import { useState } from "react";
import { Deal } from "@/lib/types";
import { StageBadge } from "./StageBadge";
import { RiskBadge, RiskDot } from "./RiskBadge";
import { DealDrawer } from "./DealDrawer";
import { formatBRL, formatRelative, formatDate, daysUntil } from "@/lib/format";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Clock } from "lucide-react";

type SortKey = "riskScore" | "amount" | "daysInCurrentStage" | "expectedCloseDate" | "lastActivityAt";

interface Props {
  deals: Deal[];
  total: number;
  onRefresh: () => void;
}

function SortButton({
  col, current, dir, onSort,
}: {
  col: SortKey; current: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const active = current === col;
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      style={{ color: active ? "var(--text)" : "var(--text-muted)" }}
    >
      {active ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
    </button>
  );
}

export function PipelineTable({ deals, total, onRefresh }: Props) {
  const [selected, setSelected] = useState<Deal | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...deals].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    if (sortKey === "amount") { av = a.amount; bv = b.amount; }
    else if (sortKey === "riskScore") { av = a.riskScore ?? 0; bv = b.riskScore ?? 0; }
    else if (sortKey === "daysInCurrentStage") { av = a.daysInCurrentStage; bv = b.daysInCurrentStage; }
    else if (sortKey === "expectedCloseDate") { av = a.expectedCloseDate; bv = b.expectedCloseDate; }
    else if (sortKey === "lastActivityAt") { av = a.lastActivityAt ?? ""; bv = b.lastActivityAt ?? ""; }
    if (typeof av === "number") return sortDir === "desc" ? (bv as number) - av : av - (bv as number);
    return sortDir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });

  return (
    <>
      <div className="flex flex-col card" style={{ minHeight: 0 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  { label: "Conta", key: null, w: "w-48" },
                  { label: "Estágio", key: null, w: "w-28" },
                  { label: "Valor", key: "amount" as SortKey, w: "w-24" },
                  { label: "Risco", key: "riskScore" as SortKey, w: "w-20" },
                  { label: "Dias", key: "daysInCurrentStage" as SortKey, w: "w-16" },
                  { label: "Último Contato", key: "lastActivityAt" as SortKey, w: "w-28" },
                  { label: "Fecha", key: "expectedCloseDate" as SortKey, w: "w-24" },
                  { label: "Owner", key: null, w: "w-28" },
                  { label: "Segmento", key: null, w: "w-16" },
                ].map(({ label, key, w }) => (
                  <th
                    key={label}
                    className={`${w} px-3 py-2.5 text-left`}
                    style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "11px", letterSpacing: "0.05em" }}
                  >
                    <div className="flex items-center gap-1 uppercase">
                      {label}
                      {key && (
                        <SortButton col={key} current={sortKey} dir={sortDir} onSort={handleSort} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((deal) => {
                const isOverdue = daysUntil(deal.expectedCloseDate) < 0;
                const risk = deal.riskScore ?? 0;
                return (
                  <tr
                    key={deal.dealId}
                    onClick={() => setSelected(deal)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: risk >= 60
                        ? "rgba(239,68,68,0.03)"
                        : risk >= 35
                        ? "rgba(245,158,11,0.02)"
                        : "transparent",
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <RiskDot score={risk} />
                        <div>
                          <div className="font-medium text-sm leading-tight truncate max-w-[160px]">
                            {deal.accountName}
                          </div>
                          <div className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                            {deal.dealId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StageBadge stage={deal.stage} small />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm font-medium">
                      {formatBRL(deal.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskBadge score={risk} compact />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm" style={{ color: deal.daysInCurrentStage > 14 ? "var(--amber)" : "var(--text-muted)" }}>
                      {deal.daysInCurrentStage}d
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      <div className="flex items-center gap-1.5">
                        {!deal.lastActivityAt && <AlertTriangle size={11} style={{ color: "var(--red)" }} />}
                        {formatRelative(deal.lastActivityAt)}
                        {deal.lastActivityType && (
                          <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                            {deal.lastActivityType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm" style={{ color: isOverdue ? "var(--red)" : "var(--text-muted)" }}>
                      <div className="flex items-center gap-1">
                        {isOverdue && <Clock size={11} />}
                        {formatDate(deal.expectedCloseDate)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      {deal.ownerName}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: deal.accountSegment === "ENT"
                            ? "rgba(245,158,11,0.1)"
                            : deal.accountSegment === "MID"
                            ? "rgba(99,102,241,0.1)"
                            : "rgba(148,163,184,0.1)",
                          color: deal.accountSegment === "ENT"
                            ? "var(--amber)"
                            : deal.accountSegment === "MID"
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        }}
                      >
                        {deal.accountSegment}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs" style={{ color: "var(--text-dim)", borderTop: "1px solid var(--border)" }}>
          Mostrando {sorted.length} de {total} deals
        </div>
      </div>

      {selected && (
        <DealDrawer
          deal={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            onRefresh();
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
