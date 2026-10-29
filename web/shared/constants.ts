// Vocabulary shared by the app and the service. The service validates
// against these lists and the app renders from them, so a new stage or
// status is one edit here.

export const STAGES = [
  { key: "lead", label: "Lead", probability: 0.1 },
  { key: "qualified", label: "Qualified", probability: 0.25 },
  { key: "proposal", label: "Proposal", probability: 0.5 },
  { key: "negotiation", label: "Negotiation", probability: 0.75 },
  { key: "won", label: "Won", probability: 1 },
  { key: "lost", label: "Lost", probability: 0 },
] as const;

export type Stage = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as [Stage, ...Stage[]];
export const CLOSED_STAGES: readonly Stage[] = ["won", "lost"];
export const isClosed = (stage: Stage) => CLOSED_STAGES.includes(stage);
export const stageOf = (key: Stage) => STAGES.find((s) => s.key === key) ?? STAGES[0];

export const CONTACT_STATUSES = [
  { key: "lead", label: "Lead" },
  { key: "active", label: "Active" },
  { key: "customer", label: "Customer" },
  { key: "churned", label: "Churned" },
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number]["key"];
export const CONTACT_STATUS_KEYS = CONTACT_STATUSES.map((s) => s.key) as [ContactStatus, ...ContactStatus[]];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

// People log the first four; the service writes the last two itself.
export const LOGGED_KINDS = ["note", "call", "email", "meeting"] as const;
export type LoggedKind = (typeof LOGGED_KINDS)[number];
export type ActivityKind = LoggedKind | "created" | "stage_change";

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

// The Pro tier's stable key in .yard/settings.json. Gate on the key, never
// the display name: renaming the tier keeps its key.
export const PRO_TIER = "pro";
export const TRIAL_DAYS = 14;

export type Plan = "free" | "pro";

// Limits follow the workspace owner's plan. null means unlimited.
export interface Limits {
  members: number;
  contacts: number | null;
  open_deals: number | null;
}

export const LIMITS: Record<Plan, Limits> = {
  free: { members: 1, contacts: 250, open_deals: 50 },
  pro: { members: 25, contacts: null, open_deals: null },
};

// Guardrails on every plan: list endpoints return at most this many rows.
export const MAX_LIST = 1000;
