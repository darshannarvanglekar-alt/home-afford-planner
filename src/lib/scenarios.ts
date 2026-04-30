// Local-storage backed scenario storage.
// Stores complete plan snapshots so users can save, compare, and re-load.
import {
  calcEMI,
  calculateAffordabilityPlan,
  loanAmount,
  summarizeInvestments,
  totalIncome,
  totalExpenses,
  totalCommitments,
  surplus,
  type AffordabilityVerdict,
  type CurrentInvestment,
  type Finances,
  type Home,
  type Profile,
} from "@/lib/plan-schema";

export const MAX_SCENARIOS = 10;

export type SavedScenario = {
  id: string;
  name: string;
  savedAt: string; // ISO
  preferred?: boolean;
  inputs: {
    finances: Finances;
    investments: CurrentInvestment[];
    home: Home;
    profile: Profile;
  };
  // Optional planner extras: corpus builder + loan relief snapshots
  corpus?: {
    monthlyInvestment: number;
    assumedReturnPct: number;
    stepUp: boolean;
    projected: number;
    target: number;
  };
  loanRelief?: {
    onetimePrepayment: number;
    totalInterest: number;
    interestSaved: number;
    closureMonthsFromNow: number;
    timeSavedMonths: number;
  };
  safetyAllocation?: number;
  outputs: {
    monthlyIncome: number;
    monthlyExpenses: number;
    existingEmis: number;
    monthlySurplus: number;
    propertyPrice: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    tenureYears: number;
    monthlyEMI: number;
    projectedCorpus: number;
    targetCorpus: number;
    corpusGap: number;
    surplusAfterEmi: number;
    verdict: AffordabilityVerdict;
    affordabilityLabel: "Comfortable" | "Stretch" | "Not Yet";
    safetyBuffer: "Built" | "Not built";
  };
};

const KEY_PREFIX = "homeafford.scenarios.v1";
const PREFIX_NO_USER = `${KEY_PREFIX}.anon`;

function key(userId: string | null | undefined) {
  return userId ? `${KEY_PREFIX}.${userId}` : PREFIX_NO_USER;
}

function safeParse(raw: string | null): SavedScenario[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SavedScenario[];
    return [];
  } catch {
    return [];
  }
}

export function listScenarios(userId?: string | null): SavedScenario[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(key(userId)));
}

export function saveScenarios(userId: string | null | undefined, list: SavedScenario[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(userId), JSON.stringify(list));
  // notify listeners in same tab
  window.dispatchEvent(new CustomEvent("homeafford:scenarios-changed"));
}

export function affordabilityLabel(v: AffordabilityVerdict): "Comfortable" | "Stretch" | "Not Yet" {
  if (v === "safe") return "Comfortable";
  if (v === "stretch") return "Stretch";
  return "Not Yet";
}

export function buildSnapshot(args: {
  name: string;
  finances: Finances;
  investments: CurrentInvestment[];
  home: Home;
  profile: Profile;
  corpus?: SavedScenario["corpus"];
  loanRelief?: SavedScenario["loanRelief"];
  preferred?: boolean;
  id?: string;
}): SavedScenario {
  const { finances, investments, home, profile } = args;
  const plan = calculateAffordabilityPlan(finances, home, profile);
  const inv = summarizeInvestments(investments, home.possessionMonth);
  const target = Math.max(
    100000,
    (home.downPayment || 0) + (home.registrationStampDuty || 0) + (home.interiorBudget || 0),
  );
  const projectedCorpus = (args.corpus?.projected ?? inv.projectedCorpus) || 0;
  const monthlyEMI = calcEMI(loanAmount(home), home.interestRateA, home.tenureYears);

  return {
    id: args.id ?? cryptoRandomId(),
    name: args.name.trim() || "Untitled scenario",
    savedAt: new Date().toISOString(),
    preferred: args.preferred,
    inputs: { finances, investments, home, profile },
    corpus: args.corpus,
    loanRelief: args.loanRelief,
    outputs: {
      monthlyIncome: totalIncome(finances),
      monthlyExpenses: totalExpenses(finances),
      existingEmis: totalCommitments(finances),
      monthlySurplus: surplus(finances),
      propertyPrice: home.propertyCost,
      downPayment: home.downPayment,
      loanAmount: loanAmount(home),
      interestRate: home.interestRateA,
      tenureYears: home.tenureYears,
      monthlyEMI,
      projectedCorpus,
      targetCorpus: args.corpus?.target ?? target,
      corpusGap: projectedCorpus - (args.corpus?.target ?? target),
      surplusAfterEmi: plan.surplusAfterEmi,
      verdict: plan.verdict,
      affordabilityLabel: affordabilityLabel(plan.verdict),
      safetyBuffer: plan.emergencyStatus === "Protected" ? "Built" : "Not built",
    },
  };
}

export function addScenario(userId: string | null | undefined, snap: SavedScenario): { ok: true } | { ok: false; reason: "limit" } {
  const list = listScenarios(userId);
  if (list.length >= MAX_SCENARIOS) return { ok: false, reason: "limit" };
  saveScenarios(userId, [snap, ...list]);
  return { ok: true };
}

export function updateScenario(userId: string | null | undefined, snap: SavedScenario) {
  const list = listScenarios(userId);
  const next = list.map((s) => (s.id === snap.id ? { ...snap, savedAt: new Date().toISOString() } : s));
  saveScenarios(userId, next);
}

export function deleteScenario(userId: string | null | undefined, id: string) {
  const list = listScenarios(userId).filter((s) => s.id !== id);
  saveScenarios(userId, list);
}

export function markPreferred(userId: string | null | undefined, id: string) {
  const list = listScenarios(userId).map((s) => ({ ...s, preferred: s.id === id }));
  saveScenarios(userId, list);
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const DRAFT_KEY = "homeafford.scenarios.pending-load";
export function stagePendingLoad(snap: SavedScenario) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
}
export function takePendingLoad(): SavedScenario | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(DRAFT_KEY);
  try {
    return JSON.parse(raw) as SavedScenario;
  } catch {
    return null;
  }
}
