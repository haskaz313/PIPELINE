import { Deal, RiskFlag, STAGE_SLA_DAYS } from "./types";

const today = () => new Date();

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((today().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((d.getTime() - today().getTime()) / (1000 * 60 * 60 * 24));
}

export function scoreRisk(deal: Deal): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  let score = 0;

  const sla = STAGE_SLA_DAYS[deal.stage];
  const inactiveDays = daysSince(deal.lastActivityAt);
  const daysToClose = daysUntil(deal.expectedCloseDate);

  // R1 — Overdue close date
  if (daysToClose < 0) {
    const overdueDays = Math.abs(daysToClose);
    const pts = Math.min(30 + Math.floor(overdueDays / 7) * 3, 40);
    score += pts;
    flags.push({
      code: "OVERDUE_CLOSE",
      label: `Close date ${overdueDays}d atrás`,
      severity: overdueDays > 30 ? "high" : "medium",
      points: pts,
    });
  }

  // R2 — Stage SLA breach
  if (sla && deal.daysInCurrentStage > sla) {
    const over = deal.daysInCurrentStage - sla;
    const pts = Math.min(15 + Math.floor(over / sla) * 5, 25);
    score += pts;
    flags.push({
      code: "SLA_BREACH",
      label: `${deal.daysInCurrentStage}d em ${deal.stage} (SLA: ${sla}d)`,
      severity: over > sla ? "high" : "medium",
      points: pts,
    });
  }

  // R3 — No activity / ghost deal
  if (deal.lastActivityAt === null) {
    score += 35;
    flags.push({
      code: "GHOST_DEAL",
      label: "Sem nenhuma atividade registrada",
      severity: "high",
      points: 35,
    });
  } else if (inactiveDays !== null && inactiveDays >= 30) {
    score += 25;
    flags.push({
      code: "INACTIVE_30D",
      label: `Sem atividade há ${inactiveDays} dias`,
      severity: "high",
      points: 25,
    });
  } else if (inactiveDays !== null && inactiveDays >= 14) {
    score += 15;
    flags.push({
      code: "INACTIVE_14D",
      label: `Sem atividade há ${inactiveDays} dias`,
      severity: "medium",
      points: 15,
    });
  }

  // R4 — Single-threaded ENT deal
  if (deal.accountSegment === "ENT" && deal.contactsLogged <= 1) {
    score += 15;
    flags.push({
      code: "SINGLE_THREADED_ENT",
      label: "ENT com apenas 1 contato",
      severity: "high",
      points: 15,
    });
  }

  // R5 — High-value deal without recent activity
  if (deal.amount >= 50000 && inactiveDays !== null && inactiveDays >= 7) {
    const pts = 10;
    score += pts;
    flags.push({
      code: "HIGH_VALUE_STALE",
      label: `Deal >R$50k parado há ${inactiveDays}d`,
      severity: inactiveDays >= 14 ? "high" : "medium",
      points: pts,
    });
  }

  // R6 — Close date approaching but no recent activity
  if (
    daysToClose > 0 &&
    daysToClose <= 7 &&
    inactiveDays !== null &&
    inactiveDays >= 5
  ) {
    score += 20;
    flags.push({
      code: "CLOSING_SOON_COLD",
      label: `Fecha em ${daysToClose}d mas ${inactiveDays}d sem atividade`,
      severity: "high",
      points: 20,
    });
  }

  // R7 — New deal, no account history and ENT/MID with no activity
  if (
    deal.previousDealsWithAccount === 0 &&
    deal.accountSegment !== "SMB" &&
    inactiveDays !== null &&
    inactiveDays >= 10
  ) {
    score += 8;
    flags.push({
      code: "NEW_ACCOUNT_COLD",
      label: "Novo cliente sem histórico e inativo",
      severity: "low",
      points: 8,
    });
  }

  const capped = Math.min(Math.round(score), 100);
  return { score: capped, flags };
}

export function applyRisk(deal: Deal): Deal {
  if (
    deal.stage === "CLOSED_WON" ||
    deal.stage === "CLOSED_LOST"
  ) {
    return { ...deal, riskScore: 0, riskFlags: [] };
  }
  const { score, flags } = scoreRisk(deal);
  return { ...deal, riskScore: score, riskFlags: flags };
}

export function riskLabel(score: number): string {
  if (score >= 60) return "Crítico";
  if (score >= 35) return "Alto";
  if (score >= 15) return "Médio";
  return "Baixo";
}

export function riskColor(score: number): string {
  if (score >= 60) return "#EF4444";
  if (score >= 35) return "#F59E0B";
  if (score >= 15) return "#EAB308";
  return "#10B981";
}
