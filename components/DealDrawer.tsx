"use client";
import { useState } from "react";
import { Deal, VALID_TRANSITIONS } from "@/lib/types";
import { StageBadge, STAGE_META } from "./StageBadge";
import { RiskBadge } from "./RiskBadge";
import { formatBRL, formatDate, formatRelative, daysSince } from "@/lib/format";
import { X, ArrowRight, Calendar, User, Bot } from "lucide-react";

interface Props {
  deal: Deal;
  onClose: () => void;
  onRefresh: () => void;
}

const LOST_REASONS = ["NO_BUDGET", "LOST_TO_COMPETITOR", "NO_DECISION", "OTHER"];

export function DealDrawer({ deal, onClose, onRefresh }: Props) {
  const [tab, setTab] = useState<"overview" | "activity" | "audit">("overview");
  const [loading, setLoading] = useState(false);
  const [activityType, setActivityType] = useState("CALL");
  const [activityNotes, setActivityNotes] = useState("");
  const [nextStepType, setNextStepType] = useState("EMAIL");
  const [nextStepNotes, setNextStepNotes] = useState("");
  const [nextStepDue, setNextStepDue] = useState("");
  const [newOwner, setNewOwner] = useState(deal.ownerName);
  const [lostReason, setLostReason] = useState("NO_BUDGET");

  const isOpen = !["CLOSED_WON", "CLOSED_LOST"].includes(deal.stage);
  const validTransitions = VALID_TRANSITIONS[deal.stage] ?? [];
  const inactiveDays = daysSince(deal.lastActivityAt);

  async function post(path: string, body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok && data.error) alert(data.error);
      else onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="h-full flex flex-col overflow-hidden card"
        style={{
          width: "min(540px, 100vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between p-5 gap-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                {deal.dealId}
              </span>
              <StageBadge stage={deal.stage} small />
            </div>
            <h2 className="text-lg font-bold truncate">{deal.accountName}</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>{deal.accountSegment}</span>
              <span>·</span>
              <span>{deal.industry}</span>
              <span>·</span>
              <span>{deal.ownerName}</span>
              {inactiveDays !== null && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--text-dim)" }}>{inactiveDays}d sem atividade</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 hover:opacity-70">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
          {(["overview", "activity", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-3 text-xs font-semibold capitalize transition-colors"
              style={{
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {t === "overview" ? "Visão Geral" : t === "activity" ? "Atividades" : "Audit Log"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {tab === "overview" && (
            <>
              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Valor", value: formatBRL(deal.amount) },
                  { label: "Produto", value: deal.productInterest },
                  { label: "Fonte", value: deal.source },
                  { label: "Contatos", value: String(deal.contactsLogged) },
                  { label: "Dias no Estágio", value: String(deal.daysInCurrentStage) },
                  { label: "Histórico Wins", value: String(deal.previousDealsWithAccount) },
                  { label: "Último Contato", value: formatRelative(deal.lastActivityAt) },
                  { label: "Fecha em", value: formatDate(deal.expectedCloseDate) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3 rounded-lg flex flex-col gap-0.5"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="font-mono font-medium text-sm">{value}</span>
                  </div>
                ))}
              </div>

              {/* Risk */}
              {isOpen && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    RISCO
                  </h3>
                  <RiskBadge score={deal.riskScore ?? 0} flags={deal.riskFlags ?? []} />
                </div>
              )}

              {/* Next steps */}
              {(deal.nextSteps ?? []).length > 0 && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    PRÓXIMOS PASSOS
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {(deal.nextSteps ?? []).map((ns) => (
                      <li key={ns.id} className="flex items-start gap-2 text-xs">
                        <Calendar size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
                        <div>
                          <span className="font-medium">{ns.type}</span>
                          <span style={{ color: "var(--text-muted)" }}> · {formatDate(ns.dueAt)}</span>
                          {ns.agentOriginated && (
                            <span className="ml-1 text-xs px-1 rounded" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
                              agente
                            </span>
                          )}
                          {ns.notes && <p style={{ color: "var(--text-muted)" }}>{ns.notes}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stage transitions */}
              {isOpen && validTransitions.length > 0 && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    MOVER ESTÁGIO
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {validTransitions.map((s) => {
                      const meta = STAGE_META[s];
                      return (
                        <button
                          key={s}
                          onClick={() => post(`/api/deals/${deal.dealId}/stage`, { stage: s })}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
                        >
                          <ArrowRight size={11} />
                          {s === "CLOSED_LOST" ? "Fechar Perdido" : s === "CLOSED_WON" ? "Fechar Ganho" : meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close deal with reason */}
              {isOpen && validTransitions.includes("CLOSED_LOST") && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    FECHAR COMO PERDIDO
                  </h3>
                  <div className="flex gap-2">
                    <select
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      className="flex-1 rounded px-2 py-1.5 text-xs font-mono"
                      style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                    >
                      {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={() => post(`/api/deals/${deal.dealId}/close`, { outcome: "CLOSED_LOST", lostReason })}
                      disabled={loading}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              {/* Reassign owner */}
              {isOpen && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    REATRIBUIR OWNER
                  </h3>
                  <div className="flex gap-2">
                    <input
                      value={newOwner}
                      onChange={(e) => setNewOwner(e.target.value)}
                      className="flex-1 rounded px-2 py-1.5 text-xs"
                      style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => post(`/api/deals/${deal.dealId}/owner`, { newOwner })}
                      disabled={loading || newOwner === deal.ownerName}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                      style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              {/* Log activity */}
              {isOpen && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    REGISTRAR ATIVIDADE
                  </h3>
                  <div className="flex flex-col gap-2">
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="rounded px-2 py-1.5 text-xs font-mono"
                      style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                    >
                      {["CALL", "EMAIL", "MEETING", "NOTE"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <textarea
                      value={activityNotes}
                      onChange={(e) => setActivityNotes(e.target.value)}
                      placeholder="Notas..."
                      rows={2}
                      className="rounded px-2 py-1.5 text-xs resize-none"
                      style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => {
                        post(`/api/deals/${deal.dealId}/activity`, { type: activityType, notes: activityNotes });
                        setActivityNotes("");
                      }}
                      disabled={loading}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                      style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}
                    >
                      Registrar
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule next step */}
              {isOpen && (
                <div className="p-4 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                    AGENDAR PRÓXIMO PASSO
                  </h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select
                        value={nextStepType}
                        onChange={(e) => setNextStepType(e.target.value)}
                        className="rounded px-2 py-1.5 text-xs font-mono"
                        style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                      >
                        {["CALL", "EMAIL", "MEETING", "NOTE"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={nextStepDue}
                        onChange={(e) => setNextStepDue(e.target.value)}
                        className="flex-1 rounded px-2 py-1.5 text-xs"
                        style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                      />
                    </div>
                    <textarea
                      value={nextStepNotes}
                      onChange={(e) => setNextStepNotes(e.target.value)}
                      placeholder="O que precisa acontecer..."
                      rows={2}
                      className="rounded px-2 py-1.5 text-xs resize-none"
                      style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => {
                        if (!nextStepDue) return alert("Selecione a data");
                        post(`/api/deals/${deal.dealId}/next-step`, {
                          type: nextStepType,
                          notes: nextStepNotes,
                          dueAt: new Date(nextStepDue).toISOString(),
                        });
                        setNextStepNotes("");
                        setNextStepDue("");
                      }}
                      disabled={loading}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
                      style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}
                    >
                      Agendar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "activity" && (
            <div className="flex flex-col gap-2">
              {(deal.activities ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhuma atividade registrada.</p>
              ) : (
                (deal.activities ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg flex flex-col gap-1"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono font-medium px-1.5 rounded"
                          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}
                        >
                          {a.type}
                        </span>
                        {a.isPlanned && (
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>planejada</span>
                        )}
                        {a.agentOriginated && (
                          <Bot size={11} style={{ color: "var(--accent)" }} />
                        )}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                        {formatRelative(a.timestamp)}
                      </span>
                    </div>
                    {a.notes && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="flex flex-col gap-2">
              {(deal.auditLog ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhum evento registrado.</p>
              ) : (
                (deal.auditLog ?? []).map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-lg flex flex-col gap-1"
                    style={{ background: "var(--surface-2)", borderLeft: `2px solid ${e.agentOriginated ? "var(--accent)" : "var(--border)"}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {e.agentOriginated ? (
                          <Bot size={12} style={{ color: "var(--accent)" }} />
                        ) : (
                          <User size={12} style={{ color: "var(--text-muted)" }} />
                        )}
                        <span className="text-xs font-semibold">{e.action}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                        {formatRelative(e.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.detail}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
