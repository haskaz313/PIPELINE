import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { Deal, Activity, NextStep, AuditEntry, Stage, VALID_TRANSITIONS } from "./types";
import { applyRisk } from "./risk";
import { v4 as uuidv4 } from "uuid";

const DATA_DIR = path.join(process.cwd(), "data");
const DEALS_FILE = path.join(DATA_DIR, "deals.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");
const NEXT_STEPS_FILE = path.join(DATA_DIR, "next_steps.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function isSeeded(): boolean {
  return fs.existsSync(DEALS_FILE);
}

export function seedFromCSV(): { count: number } {
  ensureDataDir();
  const csvPath = path.join(process.cwd(), "public", "deals.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  const deals: Deal[] = records.map((r) => ({
    dealId: r.dealId,
    accountName: r.accountName,
    accountSegment: r.accountSegment as Deal["accountSegment"],
    industry: r.industry,
    ownerName: r.ownerName,
    stage: r.stage as Stage,
    amount: parseFloat(r.amount),
    createdAt: r.createdAt,
    expectedCloseDate: r.expectedCloseDate,
    lastActivityAt: r.lastActivityAt || null,
    lastActivityType: (r.lastActivityType || null) as Deal["lastActivityType"],
    daysInCurrentStage: parseInt(r.daysInCurrentStage),
    contactsLogged: parseInt(r.contactsLogged),
    source: r.source as Deal["source"],
    productInterest: r.productInterest as Deal["productInterest"],
    previousDealsWithAccount: parseInt(r.previousDealsWithAccount),
    lostReason: null,
    stageEnteredAt: new Date(Date.now() - parseInt(r.daysInCurrentStage) * 86400000).toISOString(),
  }));

  writeJSON(DEALS_FILE, deals);
  writeJSON(ACTIVITIES_FILE, []);
  writeJSON(NEXT_STEPS_FILE, []);
  writeJSON(AUDIT_FILE, []);

  return { count: deals.length };
}

export function getDeals(): Deal[] {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  const activities = readJSON<Activity[]>(ACTIVITIES_FILE, []);
  const nextSteps = readJSON<NextStep[]>(NEXT_STEPS_FILE, []);
  const audit = readJSON<AuditEntry[]>(AUDIT_FILE, []);

  return deals.map((d) => {
    const enriched: Deal = {
      ...d,
      activities: activities.filter((a) => a.dealId === d.dealId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      nextSteps: nextSteps.filter((n) => n.dealId === d.dealId && !n.completed).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
      auditLog: audit.filter((e) => e.dealId === d.dealId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
    return applyRisk(enriched);
  });
}

export function getDeal(dealId: string): Deal | null {
  const deals = getDeals();
  return deals.find((d) => d.dealId === dealId) ?? null;
}

export function updateStage(
  dealId: string,
  newStage: Stage,
  actor: string,
  agentOriginated: boolean
): { ok: boolean; error?: string; deal?: Deal } {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  const idx = deals.findIndex((d) => d.dealId === dealId);
  if (idx === -1) return { ok: false, error: "Deal não encontrado" };

  const deal = deals[idx];
  const allowed = VALID_TRANSITIONS[deal.stage];
  if (!allowed.includes(newStage)) {
    return {
      ok: false,
      error: `Transição inválida: ${deal.stage} → ${newStage}. Permitido: ${allowed.join(", ")}`,
    };
  }

  const prevStage = deal.stage;
  deals[idx] = {
    ...deal,
    stage: newStage,
    stageEnteredAt: new Date().toISOString(),
    daysInCurrentStage: 0,
  };
  writeJSON(DEALS_FILE, deals);
  appendAudit({
    dealId,
    actor,
    agentOriginated,
    action: "STAGE_CHANGE",
    detail: `Estágio alterado de ${prevStage} para ${newStage}`,
    prev: prevStage,
    next: newStage,
  });

  return { ok: true, deal: applyRisk(deals[idx]) };
}

export function logActivity(
  dealId: string,
  type: Activity["type"],
  notes: string,
  actor: string,
  agentOriginated: boolean,
  isPlanned = false,
  scheduledAt?: string
): { ok: boolean; activity?: Activity; error?: string } {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  const idx = deals.findIndex((d) => d.dealId === dealId);
  if (idx === -1) return { ok: false, error: "Deal não encontrado" };

  const activity: Activity = {
    id: uuidv4(),
    dealId,
    type,
    notes,
    timestamp: new Date().toISOString(),
    isPlanned,
    scheduledAt: scheduledAt ?? null,
    createdBy: actor,
    agentOriginated,
  };

  const activities = readJSON<Activity[]>(ACTIVITIES_FILE, []);
  activities.push(activity);
  writeJSON(ACTIVITIES_FILE, activities);

  if (!isPlanned) {
    deals[idx] = {
      ...deals[idx],
      lastActivityAt: activity.timestamp,
      lastActivityType: type,
    };
    writeJSON(DEALS_FILE, deals);
  }

  appendAudit({
    dealId,
    actor,
    agentOriginated,
    action: isPlanned ? "ACTIVITY_PLANNED" : "ACTIVITY_LOGGED",
    detail: `${isPlanned ? "Planejado" : "Registrado"}: ${type}${notes ? ` — ${notes.substring(0, 80)}` : ""}`,
  });

  return { ok: true, activity };
}

export function scheduleNextStep(
  dealId: string,
  type: NextStep["type"],
  notes: string,
  dueAt: string,
  actor: string,
  agentOriginated: boolean
): { ok: boolean; nextStep?: NextStep; error?: string } {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  if (!deals.find((d) => d.dealId === dealId)) {
    return { ok: false, error: "Deal não encontrado" };
  }

  const nextStep: NextStep = {
    id: uuidv4(),
    dealId,
    type,
    notes,
    dueAt,
    createdAt: new Date().toISOString(),
    createdBy: actor,
    agentOriginated,
    completed: false,
  };

  const steps = readJSON<NextStep[]>(NEXT_STEPS_FILE, []);
  steps.push(nextStep);
  writeJSON(NEXT_STEPS_FILE, steps);

  appendAudit({
    dealId,
    actor,
    agentOriginated,
    action: "NEXT_STEP_SCHEDULED",
    detail: `${type} agendado para ${dueAt}${notes ? ` — ${notes.substring(0, 80)}` : ""}`,
  });

  return { ok: true, nextStep };
}

export function reassignOwner(
  dealId: string,
  newOwner: string,
  actor: string,
  agentOriginated: boolean
): { ok: boolean; error?: string } {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  const idx = deals.findIndex((d) => d.dealId === dealId);
  if (idx === -1) return { ok: false, error: "Deal não encontrado" };

  const prevOwner = deals[idx].ownerName;
  deals[idx] = { ...deals[idx], ownerName: newOwner };
  writeJSON(DEALS_FILE, deals);

  appendAudit({
    dealId,
    actor,
    agentOriginated,
    action: "OWNER_REASSIGNED",
    detail: `Owner alterado de ${prevOwner} para ${newOwner}`,
    prev: prevOwner,
    next: newOwner,
  });

  return { ok: true };
}

export function closeDeal(
  dealId: string,
  outcome: "CLOSED_WON" | "CLOSED_LOST",
  lostReason: string | null,
  actor: string,
  agentOriginated: boolean
): { ok: boolean; error?: string } {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  const idx = deals.findIndex((d) => d.dealId === dealId);
  if (idx === -1) return { ok: false, error: "Deal não encontrado" };

  const deal = deals[idx];
  if (!VALID_TRANSITIONS[deal.stage].includes(outcome)) {
    return { ok: false, error: `Transição inválida: ${deal.stage} → ${outcome}` };
  }
  if (outcome === "CLOSED_LOST" && !lostReason) {
    return { ok: false, error: "Motivo obrigatório para CLOSED_LOST" };
  }

  deals[idx] = {
    ...deal,
    stage: outcome,
    lostReason: (lostReason as Deal["lostReason"]) ?? null,
    stageEnteredAt: new Date().toISOString(),
    daysInCurrentStage: 0,
  };
  writeJSON(DEALS_FILE, deals);

  appendAudit({
    dealId,
    actor,
    agentOriginated,
    action: "DEAL_CLOSED",
    detail: outcome === "CLOSED_WON"
      ? "Deal fechado como GANHO"
      : `Deal fechado como PERDIDO — ${lostReason}`,
    prev: deal.stage,
    next: outcome,
  });

  return { ok: true };
}

export function getOwners(): string[] {
  const deals = readJSON<Deal[]>(DEALS_FILE, []);
  return [...new Set(deals.map((d) => d.ownerName))].sort();
}

function appendAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const audit = readJSON<AuditEntry[]>(AUDIT_FILE, []);
  audit.push({
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  writeJSON(AUDIT_FILE, audit);
}

export function getPipelineStats() {
  const deals = getDeals();
  const open = deals.filter((d) => !["CLOSED_WON", "CLOSED_LOST"].includes(d.stage));
  const won = deals.filter((d) => d.stage === "CLOSED_WON");
  const lost = deals.filter((d) => d.stage === "CLOSED_LOST");

  const stageStats = ["LEAD", "QUALIFIED", "DISCOVERY", "DEMO", "PROPOSAL", "NEGOTIATION"].map((stage) => {
    const inStage = open.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((s, d) => s + d.amount, 0),
      avgRisk: inStage.length ? Math.round(inStage.reduce((s, d) => s + (d.riskScore ?? 0), 0) / inStage.length) : 0,
    };
  });

  const ownerStats = getOwners().map((owner) => {
    const ownerDeals = open.filter((d) => d.ownerName === owner);
    return {
      owner,
      count: ownerDeals.length,
      value: ownerDeals.reduce((s, d) => s + d.amount, 0),
      avgRisk: ownerDeals.length ? Math.round(ownerDeals.reduce((s, d) => s + (d.riskScore ?? 0), 0) / ownerDeals.length) : 0,
      criticalCount: ownerDeals.filter((d) => (d.riskScore ?? 0) >= 60).length,
    };
  });

  const totalOpen = open.reduce((s, d) => s + d.amount, 0);
  const winRate = (won.length + lost.length) > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100)
    : 0;
  const riskyDeals = open.filter((d) => (d.riskScore ?? 0) >= 35).length;
  const criticalDeals = open.filter((d) => (d.riskScore ?? 0) >= 60).length;

  const weightedPipeline = open.reduce((s, d) => {
    const stageWeights: Record<string, number> = {
      LEAD: 0.05, QUALIFIED: 0.1, DISCOVERY: 0.2, DEMO: 0.3, PROPOSAL: 0.5, NEGOTIATION: 0.8,
    };
    return s + d.amount * (stageWeights[d.stage] ?? 0);
  }, 0);

  return {
    openCount: open.length,
    totalOpen,
    weightedPipeline,
    winRate,
    wonCount: won.length,
    lostCount: lost.length,
    riskyDeals,
    criticalDeals,
    stageStats,
    ownerStats,
  };
}
