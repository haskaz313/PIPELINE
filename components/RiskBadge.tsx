"use client";
import { RiskFlag } from "@/lib/types";
import { riskLabel } from "@/lib/risk";

interface Props {
  score: number;
  flags?: RiskFlag[];
  compact?: boolean;
}

function riskStyle(score: number): { bg: string; text: string; bar: string } {
  if (score >= 60) return { bg: "rgba(239,68,68,0.12)", text: "#ef4444", bar: "#ef4444" };
  if (score >= 35) return { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", bar: "#f59e0b" };
  if (score >= 15) return { bg: "rgba(234,179,8,0.12)", text: "#eab308", bar: "#eab308" };
  return { bg: "rgba(16,185,129,0.08)", text: "#10b981", bar: "#10b981" };
}

export function RiskBadge({ score, flags = [], compact = false }: Props) {
  const { bg, text, bar } = riskStyle(score);
  const label = riskLabel(score);

  if (compact) {
    return (
      <span
        className="font-mono text-xs font-medium px-1.5 py-0.5 rounded"
        style={{ background: bg, color: text }}
      >
        {score}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-xs font-medium px-2 py-0.5 rounded"
          style={{ background: bg, color: text }}
        >
          {score} · {label}
        </span>
      </div>
      <div className="w-full h-1 rounded-full" style={{ background: "var(--surface-3)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: bar }}
        />
      </div>
      {flags.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {flags.map((f) => (
            <li key={f.code} className="text-xs" style={{ color: "var(--text-muted)" }}>
              · {f.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RiskDot({ score }: { score: number }) {
  const { text } = riskStyle(score);
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: text }}
    />
  );
}
