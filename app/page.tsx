"use client";
import { useState, useEffect, useCallback } from "react";
import { Deal, Stage } from "@/lib/types";
import { PipelineTable } from "@/components/PipelineTable";
import { AIChat } from "@/components/AIChat";
import { PipelineCharts } from "@/components/Charts";
import { StageBadge } from "@/components/StageBadge";
import { formatBRL } from "@/lib/format";
import {
  LayoutGrid, BarChart2, BotMessageSquare, Search, SlidersHorizontal,
  AlertTriangle, Clock, RefreshCw, X,
} from "lucide-react";

const OPEN_STAGES: Stage[] = ["LEAD", "QUALIFIED", "DISCOVERY", "DEMO", "PROPOSAL", "NEGOTIATION"];

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  interface StageStat { stage: Stage; count: number; value: number; avgRisk?: number }
  interface OwnerStat { owner: string; count: number; value: number; criticalCount?: number }
  interface Stats {
    stageStats?: StageStat[];
    ownerStats?: OwnerStat[];
    criticalDeals?: number;
    riskyDeals?: number;
    openCount?: number;
    totalOpen?: number;
    weightedPipeline?: number;
    winRate?: number;
    wonCount?: number;
    lostCount?: number;
  }

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "charts">("table");
  const [agentOpen, setAgentOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<Stage[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [riskMin, setRiskMin] = useState<number | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [riskyOnly, setRiskyOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  async function ensureSeeded() {
    const r = await fetch("/api/seed");
    const d = await r.json();
    if (!d.seeded) {
      await fetch("/api/seed", { method: "POST" });
    }
    setInitialized(true);
  }

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedStages.length) params.set("stage", selectedStages.join(","));
    if (selectedSegments.length) params.set("segment", selectedSegments.join(","));
    if (selectedOwners.length) params.set("owner", selectedOwners.join(","));
    if (riskMin !== "") params.set("riskMin", String(riskMin));
    if (overdueOnly) params.set("overdue", "1");
    if (riskyOnly) params.set("risky", "1");
    params.set("limit", "500");

    const [dealsRes, statsRes] = await Promise.all([
      fetch(`/api/deals?${params}`),
      fetch("/api/deals?stats=1"),
    ]);
    const dealsData = await dealsRes.json();
    const statsData = await statsRes.json();
    setDeals(dealsData.deals ?? []);
    setTotal(dealsData.total ?? 0);
    setStats(statsData);
    setLoading(false);
  }, [searchQuery, selectedStages, selectedSegments, selectedOwners, riskMin, overdueOnly, riskyOnly]);

  useEffect(() => {
    (async () => { await ensureSeeded(); })();
  }, []);

  useEffect(() => {
    if (initialized) {
      (async () => { await fetchDeals(); })();
    }
  }, [initialized, fetchDeals]);

  const criticalCount = stats?.criticalDeals ?? 0;

  function clearFilters() {
    setSelectedStages([]);
    setSelectedSegments([]);
    setSelectedOwners([]);
    setRiskMin("");
    setOverdueOnly(false);
    setRiskyOnly(false);
    setSearchQuery("");
  }

  const hasFilters =
    selectedStages.length > 0 || selectedSegments.length > 0 ||
    selectedOwners.length > 0 || riskMin !== "" || overdueOnly || riskyOnly || searchQuery;

  function toggleArray<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="card flex items-center justify-between px-5 py-3 flex-shrink-0 gap-4"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                P
              </div>
              <span className="font-bold text-base">Pipeline</span>
            </div>

            {/* View switcher */}
            <div
              className="flex rounded-lg p-0.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              {[
                { id: "table", icon: LayoutGrid, label: "Deals" },
                { id: "charts", icon: BarChart2, label: "Dashboard" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id as typeof view)}
                  className="btn flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    background: view === id ? "var(--surface-3)" : "transparent",
                    color: view === id ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conta, deal, rep..."
                className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <button
                onClick={() => { setRiskMin(60); setRiskyOnly(false); }}
                className="btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
              >
                <AlertTriangle size={12} />
                {criticalCount} crítico{criticalCount !== 1 ? "s" : ""}
              </button>
            )}

            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filtersOpen || hasFilters ? "rgba(99,102,241,0.15)" : "var(--surface-2)",
                color: filtersOpen || hasFilters ? "var(--accent)" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              <SlidersHorizontal size={12} />
              Filtros
              {hasFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
            </button>

            <button
              onClick={() => fetchDeals()}
              className="btn p-1.5 rounded-lg hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setAgentOpen((v) => !v)}
              className="btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: agentOpen ? "rgba(99,102,241,0.15)" : "var(--surface-2)",
                color: agentOpen ? "var(--accent)" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              <BotMessageSquare size={12} />
              Agente
            </button>
          </div>
        </header>

        {/* Filters panel */}
        {filtersOpen && (
          <div
            className="card px-5 py-3 flex flex-wrap items-center gap-4"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
          >
            {/* Stages */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Estágio</label>
              <div className="flex flex-wrap gap-1">
                {OPEN_STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStages((prev) => toggleArray(prev, s))}
                    className="text-xs px-2 py-0.5 rounded transition-opacity hover:opacity-80"
                    style={{
                      background: selectedStages.includes(s) ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
                      color: selectedStages.includes(s) ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${selectedStages.includes(s) ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Segments */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Segmento</label>
              <div className="flex gap-1">
                {["SMB", "MID", "ENT"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSegments((prev) => toggleArray(prev, s))}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: selectedSegments.includes(s) ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
                      color: selectedSegments.includes(s) ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${selectedSegments.includes(s) ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick filters */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Filtros Rápidos</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setRiskyOnly((v) => !v)}
                  className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                  style={{
                    background: riskyOnly ? "rgba(245,158,11,0.15)" : "var(--surface-2)",
                    color: riskyOnly ? "var(--amber)" : "var(--text-muted)",
                    border: `1px solid ${riskyOnly ? "rgba(245,158,11,0.4)" : "var(--border)"}`,
                  }}
                >
                  <AlertTriangle size={10} />
                  Em Risco
                </button>
                <button
                  onClick={() => setOverdueOnly((v) => !v)}
                  className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                  style={{
                    background: overdueOnly ? "rgba(239,68,68,0.12)" : "var(--surface-2)",
                    color: overdueOnly ? "#ef4444" : "var(--text-muted)",
                    border: `1px solid ${overdueOnly ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                  }}
                >
                  <Clock size={10} />
                  Atrasado
                </button>
              </div>
            </div>

            {/* Risk min */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Risco mín.</label>
              <input
                type="number"
                value={riskMin}
                onChange={(e) => setRiskMin(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0–100"
                className="rounded px-2 py-1 text-xs w-20"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs mt-4 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={11} />
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Pipeline summary bar */}
        {stats && view === "table" && (
          <div
            className="card flex items-center gap-5 px-5 py-2 flex-shrink-0 overflow-x-auto"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            {stats.stageStats?.map((s: StageStat) => (
              <button
                key={s.stage}
                onClick={() => setSelectedStages((prev) =>
                  prev.includes(s.stage) ? prev.filter((x: Stage) => x !== s.stage) : [...prev, s.stage]
                )}
                className="flex items-center gap-2 text-xs whitespace-nowrap transition-opacity hover:opacity-80"
                style={{ opacity: selectedStages.length === 0 || selectedStages.includes(s.stage) ? 1 : 0.4 }}
              >
                <StageBadge stage={s.stage as Stage} small />
                <span className="font-mono font-medium">{s.count}</span>
                <span style={{ color: "var(--text-dim)" }}>{formatBRL(s.value)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && !deals.length ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Carregando pipeline...
                </span>
              </div>
            </div>
          ) : view === "table" ? (
            <PipelineTable deals={deals} total={total} onRefresh={fetchDeals} />
          ) : (
            stats && <PipelineCharts {...stats} />
          )}
        </div>
      </div>

      {/* Agent panel */}
      {agentOpen && (
        <div
          className="flex-shrink-0 hidden lg:flex"
          style={{ width: "360px", borderLeft: "1px solid var(--border)" }}
        >
          <AIChat onRefresh={fetchDeals} isOpen={agentOpen} onToggle={() => setAgentOpen(false)} />
        </div>
      )}
    </div>
  );
}
