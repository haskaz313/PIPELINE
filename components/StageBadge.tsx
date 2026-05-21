"use client";
import { Stage } from "@/lib/types";

const STAGE_META: Record<Stage, { label: string; color: string; bg: string }> = {
  LEAD: { label: "Lead", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  QUALIFIED: { label: "Qualificado", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  DISCOVERY: { label: "Discovery", color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  DEMO: { label: "Demo", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  PROPOSAL: { label: "Proposta", color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
  NEGOTIATION: { label: "Negociação", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  CLOSED_WON: { label: "Ganho", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  CLOSED_LOST: { label: "Perdido", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export function StageBadge({ stage, small = false }: { stage: Stage; small?: boolean }) {
  const meta = STAGE_META[stage] ?? { label: stage, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return (
    <span
      className={`inline-block font-mono font-medium rounded whitespace-nowrap ${small ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1"}`}
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

export function stageColor(stage: Stage): string {
  return STAGE_META[stage]?.color ?? "#94a3b8";
}

export function stageLabel(stage: Stage): string {
  return STAGE_META[stage]?.label ?? stage;
}

export { STAGE_META };
