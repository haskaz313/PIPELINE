export type Stage =
  | "LEAD"
  | "QUALIFIED"
  | "DISCOVERY"
  | "DEMO"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type Segment = "SMB" | "MID" | "ENT";
export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "NOTE";
export type LostReason =
  | "NO_BUDGET"
  | "LOST_TO_COMPETITOR"
  | "NO_DECISION"
  | "OTHER";
export type Source = "INBOUND" | "OUTBOUND" | "REFERRAL" | "PARTNER" | "EVENT";
export type ProductInterest = "CORE" | "PRO" | "ENTERPRISE" | "BUNDLE";

export interface Deal {
  dealId: string;
  accountName: string;
  accountSegment: Segment;
  industry: string;
  ownerName: string;
  stage: Stage;
  amount: number;
  createdAt: string;
  expectedCloseDate: string;
  lastActivityAt: string | null;
  lastActivityType: ActivityType | null;
  daysInCurrentStage: number;
  contactsLogged: number;
  source: Source;
  productInterest: ProductInterest;
  previousDealsWithAccount: number;
  riskScore?: number;
  riskFlags?: RiskFlag[];
  activities?: Activity[];
  nextSteps?: NextStep[];
  auditLog?: AuditEntry[];
  lostReason?: LostReason | null;
  stageEnteredAt?: string;
}

export interface RiskFlag {
  code: string;
  label: string;
  severity: "low" | "medium" | "high";
  points: number;
}

export interface Activity {
  id: string;
  dealId: string;
  type: ActivityType;
  notes: string;
  timestamp: string;
  scheduledAt?: string | null;
  isPlanned?: boolean;
  createdBy: string;
  agentOriginated?: boolean;
}

export interface NextStep {
  id: string;
  dealId: string;
  type: ActivityType;
  notes: string;
  dueAt: string;
  createdAt: string;
  createdBy: string;
  agentOriginated?: boolean;
  completed?: boolean;
}

export interface AuditEntry {
  id: string;
  dealId: string;
  timestamp: string;
  actor: string;
  agentOriginated: boolean;
  action: string;
  detail: string;
  prev?: string;
  next?: string;
}

export interface PipelineFilters {
  stages?: Stage[];
  segments?: Segment[];
  owners?: string[];
  minAmount?: number;
  maxAmount?: number;
  riskMin?: number;
  riskMax?: number;
  search?: string;
  overdueOnly?: boolean;
  riskyOnly?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
}

export const VALID_TRANSITIONS: Record<Stage, Stage[]> = {
  LEAD: ["QUALIFIED", "CLOSED_LOST"],
  QUALIFIED: ["DISCOVERY", "CLOSED_LOST"],
  DISCOVERY: ["DEMO", "CLOSED_LOST"],
  DEMO: ["PROPOSAL", "CLOSED_LOST"],
  PROPOSAL: ["NEGOTIATION", "CLOSED_LOST"],
  NEGOTIATION: ["CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON: [],
  CLOSED_LOST: [],
};

export const STAGE_SLA_DAYS: Record<string, number> = {
  LEAD: 14,
  QUALIFIED: 10,
  DISCOVERY: 14,
  DEMO: 7,
  PROPOSAL: 14,
  NEGOTIATION: 21,
};

export const STAGE_ORDER: Stage[] = [
  "LEAD",
  "QUALIFIED",
  "DISCOVERY",
  "DEMO",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];
