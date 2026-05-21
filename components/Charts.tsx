"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { formatBRL } from "@/lib/format";
import { stageLabel, stageColor } from "./StageBadge";
import { Stage } from "@/lib/types";

interface StageStats {
  stage: string;
  count: number;
  value: number;
  avgRisk: number;
}

interface OwnerStats {
  owner: string;
  count: number;
  value: number;
  avgRisk: number;
  criticalCount: number;
}

interface Props {
  stageStats: StageStats[];
  ownerStats: OwnerStats[];
  openCount: number;
  totalOpen: number;
  weightedPipeline: number;
  winRate: number;
  wonCount: number;
  lostCount: number;
  riskyDeals: number;
  criticalDeals: number;
}

type TooltipPayloadItem = { name?: string; value?: number | string; color?: string };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-2 rounded text-xs" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? "var(--text)" }}>
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? formatBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export function PipelineCharts({
  stageStats, ownerStats, openCount, totalOpen,
  weightedPipeline, winRate, wonCount, lostCount, riskyDeals, criticalDeals,
}: Props) {
  // funnelData removed (rendered as table for clarity)

  const ownerChartData = ownerStats
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="card flex flex-col gap-5 p-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Pipeline Aberto", value: formatBRL(totalOpen), sub: `${openCount} deals` },
          { label: "Pipeline Ponderado", value: formatBRL(weightedPipeline), sub: "por estágio" },
          { label: "Win Rate", value: `${winRate}%`, sub: `${wonCount} won · ${lostCount} lost` },
          { label: "Em Risco", value: String(riskyDeals), sub: `${criticalDeals} críticos`, accent: criticalDeals > 0 ? "#ef4444" : undefined },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="p-4 rounded-xl flex flex-col gap-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</span>
            <span className="text-2xl font-bold font-mono" style={{ color: accent ?? "var(--text)" }}>{value}</span>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Funnel */}
        <div className="p-4 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Funil por Estágio
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Estágio", "Deals", "Valor", "Risco Médio"].map((h) => (
                    <th key={h} className="pb-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stageStats.map((s) => (
                  <tr key={s.stage} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2"><span style={{ color: stageColor(s.stage as Stage) }}>{stageLabel(s.stage as Stage)}</span></td>
                    <td className="py-2 font-mono">{s.count}</td>
                    <td className="py-2 font-mono">{formatBRL(s.value)}</td>
                    <td className="py-2">
                      <span
                        className="font-mono px-1.5 rounded"
                        style={{
                          background: s.avgRisk >= 35 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.1)",
                          color: s.avgRisk >= 35 ? "var(--amber)" : "var(--green)",
                        }}
                      >
                        {s.avgRisk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Owner workload */}
        <div className="p-4 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Carga por Rep
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ownerChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRL(v)} />
              <YAxis type="category" dataKey="owner" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Valor" radius={2}>
                {ownerChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.criticalCount > 0 ? "#f59e0b" : "#6366f1"} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Value by stage bar */}
      <div className="p-4 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
          Valor por Estágio (R$)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stageStats} margin={{ bottom: 0 }}>
            <XAxis
              dataKey="stage"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => stageLabel(v as Stage)}
            />
            <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRL(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Valor" radius={[3, 3, 0, 0]}>
              {stageStats.map((s, i) => (
                <Cell key={i} fill={stageColor(s.stage as Stage)} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
