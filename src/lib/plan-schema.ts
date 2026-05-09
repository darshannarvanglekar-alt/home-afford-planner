import { z } from "zod";

const num = z.number().min(0).default(0);

// ============================================================
// Payment frequency support (Change 8)
// ============================================================
export const PAYMENT_FREQUENCIES = ["monthly", "quarterly", "half_yearly", "annually"] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

export const paymentFrequencyLabels: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annually: "Annually",
};

const FREQ_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  annually: 12,
};

export function monthlyEquivalent(amount: number, frequency: PaymentFrequency): number {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe / FREQ_MONTHS[frequency];
}

// An amount that may be paid at any frequency. We always store the original
// amount + frequency together so display + calculation are consistent.
export const amountWithFrequencySchema = z
  .union([
    z.number(),
    z.object({
      amount: num,
      frequency: z.enum(PAYMENT_FREQUENCIES).default("monthly"),
    }),
  ])
  .transform((v) => {
    if (typeof v === "number") return { amount: v, frequency: "monthly" as PaymentFrequency };
    return { amount: v.amount, frequency: v.frequency };
  });
export type AmountWithFrequency = { amount: number; frequency: PaymentFrequency };

export function awfMonthly(value: AmountWithFrequency | number | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  return monthlyEquivalent(value.amount, value.frequency);
}

// ============================================================
// Existing EMIs as a list with end dates (Change 5)
// ============================================================
// endDate stored as "YYYY-MM" (first day of month considered active that month;
// EMI is "active" while month index ≤ endMonthIndex measured from "today").
export const existingEmiSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  amount: num,
  // ISO month string YYYY-MM
  endDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type ExistingEmi = z.infer<typeof existingEmiSchema>;

function todayYM(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthsUntilEndDate(endDate: string | undefined): number | null {
  if (!endDate) return null; // no end date = treat as ongoing
  const m = endDate.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ey = Number(m[1]);
  const em = Number(m[2]);
  const t = todayYM();
  return (ey - t.year) * 12 + (em - t.month);
}

export function isEmiActiveAtOffset(emi: ExistingEmi, monthOffset: number): boolean {
  const remaining = monthsUntilEndDate(emi.endDate);
  if (remaining === null) return true; // ongoing
  return monthOffset <= remaining;
}

export const PROPERTY_TYPES = ["ready", "construction", "plot"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const builderStageSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  month: z.number().int().min(1).default(1),
  bankPays: num,
  youPay: num,
});
export type BuilderStage = z.infer<typeof builderStageSchema>;

export const homeSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES).default("ready"),
  propertyCost: num,
  downPayment: num,
  city: z.string().default(""),
  builderName: z.string().default(""),
  interestRateA: z.number().min(0).max(50).default(8.5),
  interestRateB: z.number().min(0).max(50).optional(),
  tenureYears: z.number().int().min(1).max(40).default(20),
  builderStages: z.array(builderStageSchema).default([]),
  disbursementStages: z.number().int().min(2).max(6).default(3),
  registrationStampDuty: num,
  interiorBudget: num,
  possessionMonth: z.number().int().min(1).max(60).default(1),
});
export type Home = z.infer<typeof homeSchema>;

export const defaultHome: Home = {
  propertyType: "ready",
  propertyCost: 0,
  downPayment: 0,
  city: "",
  builderName: "",
  interestRateA: 8.5,
  interestRateB: undefined,
  tenureYears: 20,
  builderStages: [
    { id: "s1", name: "Stage 1", month: 1, bankPays: 0, youPay: 0 },
    { id: "s2", name: "Stage 2", month: 13, bankPays: 0, youPay: 0 },
  ],
  disbursementStages: 3,
  registrationStampDuty: 0,
  interiorBudget: 0,
  possessionMonth: 1,
};

export function loanAmount(h: Home): number {
  return Math.max(0, safeNumber(h.propertyCost) - safeNumber(h.downPayment));
}

export function calcEMI(principal: number, annualRatePct: number, tenureYears: number): number {
  const safePrincipal = safeNumber(principal);
  const safeRate = safeNumber(annualRatePct);
  const safeTenure = safeNumber(tenureYears);
  if (!safePrincipal || safePrincipal <= 0) return 0;
  if (!safeTenure || safeTenure <= 0) return 0;
  const n = safeTenure * 12;
  const r = safeRate / 12 / 100;
  if (r === 0) return safePrincipal / n;
  const pow = Math.pow(1 + r, n);
  const emi = (safePrincipal * r * pow) / (pow - 1);
  return Number.isFinite(emi) ? emi : 0;
}

export const financesSchema = z.object({
  income: z.object({
    primarySalary: num,
    additionalIncome: num,
    familyContribution: num,
  }),
  commitments: z.object({
    // Legacy single-number EMI total (kept for back-compat)
    emis: num,
    insurance: num,
    // New structured list of EMIs with end dates (Change 5)
    emiList: z.array(existingEmiSchema).default([]).optional(),
  }),
  expenses: z
    .object({
      housing: amountWithFrequencySchema.optional(),
      family: amountWithFrequencySchema.optional(),
      health: amountWithFrequencySchema.optional(),
      daily: amountWithFrequencySchema.optional(),
      schoolFees: amountWithFrequencySchema.optional(),
      discretionary: amountWithFrequencySchema.optional(),
      // Backward compat: accept legacy "investments" key
      investments: amountWithFrequencySchema.optional(),
    })
    .transform((v) => {
      const def: AmountWithFrequency = { amount: 0, frequency: "monthly" };
      const out = {
        housing: v.housing ?? def,
        family: v.family ?? def,
        health: v.health ?? def,
        daily: v.daily ?? def,
        schoolFees: v.schoolFees ?? def,
        discretionary: v.discretionary ?? def,
      };
      if ((out.schoolFees.amount ?? 0) === 0 && v.investments && v.investments.amount > 0) {
        out.schoolFees = v.investments;
      }
      return out;
    }),
});

export type Finances = z.infer<typeof financesSchema>;

export const defaultFinances: Finances = {
  income: { primarySalary: 0, additionalIncome: 0, familyContribution: 0 },
  commitments: { emis: 0, insurance: 0, emiList: [] },
  expenses: {
    housing: { amount: 0, frequency: "monthly" },
    family: { amount: 0, frequency: "monthly" },
    health: { amount: 0, frequency: "monthly" },
    daily: { amount: 0, frequency: "monthly" },
    schoolFees: { amount: 0, frequency: "monthly" },
    discretionary: { amount: 0, frequency: "monthly" },
  },
};
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

export function totalIncome(f: Finances): number {
  const i = f.income;
  return safeNumber(i.primarySalary) + safeNumber(i.additionalIncome) + safeNumber(i.familyContribution);
}

export function totalEmiList(f: Finances, monthOffset = 0): number {
  const list = f.commitments.emiList ?? [];
  return list
    .filter((e) => isEmiActiveAtOffset(e, monthOffset))
    .reduce((sum, e) => sum + safeNumber(e.amount), 0);
}

export function totalCommitments(f: Finances, monthOffset = 0): number {
  // Prefer structured EMI list when populated, otherwise fall back to legacy total.
  const list = f.commitments.emiList ?? [];
  if (list.length > 0) return totalEmiList(f, monthOffset);
  return safeNumber(f.commitments.emis);
}

export function totalExpenses(f: Finances): number {
  const e = f.expenses;
  return (
    awfMonthly(e.housing) +
    awfMonthly(e.family) +
    awfMonthly(e.health) +
    awfMonthly(e.daily) +
    awfMonthly(e.schoolFees) +
    awfMonthly(e.discretionary)
  );
}

export function totalOutflow(f: Finances, monthOffset = 0): number {
  return totalCommitments(f, monthOffset) + totalExpenses(f);
}

export function surplus(f: Finances): number {
  const value = totalIncome(f) - totalOutflow(f, 0);
  return Number.isFinite(value) ? value : 0;
}

// Month-by-month surplus that drops EMIs as their end dates pass (Change 5).
export function surplusAtOffset(f: Finances, monthOffset: number): number {
  const value = totalIncome(f) - totalOutflow(f, monthOffset);
  return Number.isFinite(value) ? value : 0;
}

// Returns events for EMIs that end within the build-up window, ordered by month.
export function upcomingEmiEndEvents(
  f: Finances,
  windowMonths: number,
): Array<{ id: string; label: string; amount: number; endsInMonth: number; endDate: string }> {
  const list = f.commitments.emiList ?? [];
  const events = list
    .map((e) => {
      const remaining = monthsUntilEndDate(e.endDate);
      if (remaining === null || remaining < 0) return null;
      if (remaining > windowMonths) return null;
      return {
        id: e.id,
        label: e.label || "EMI",
        amount: e.amount,
        endsInMonth: remaining,
        endDate: e.endDate as string,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  events.sort((a, b) => a.endsInMonth - b.endsInMonth);
  return events;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export const INVESTMENT_TYPES = [
  "monthly_market",
  "monthly_fixed",
  "recurring_deposit",
  "fixed_deposit",
  "pooled_saving",
  "gold_accumulation",
  "protection_plan",
  "ppf_style",
  "other",
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const investmentTypeLabels: Record<InvestmentType, string> = {
  monthly_market: "Monthly investment (market-linked)",
  monthly_fixed: "Monthly fixed return saving",
  recurring_deposit: "Recurring deposit",
  fixed_deposit: "Fixed deposit (lump sum)",
  pooled_saving: "Chit-style pooled saving",
  gold_accumulation: "Gold accumulation",
  protection_plan: "Insurance / protection plan",
  ppf_style: "Public provident fund-style saving",
  other: "Other investment",
};

export const investmentDefaultRates: Record<InvestmentType, number> = {
  monthly_market: 10,
  monthly_fixed: 7,
  recurring_deposit: 7,
  fixed_deposit: 7,
  pooled_saving: 9,
  gold_accumulation: 8,
  protection_plan: 5,
  ppf_style: 7.1,
  other: 8,
};

// ============================================================
// Insurance subtypes (Change 6) — only relevant when type === "protection_plan"
// ============================================================
export const INSURANCE_SUBTYPES = [
  "term",
  "endowment",
  "market_linked",
  "child_education",
  "medical",
  "personal_accident",
  "pension_annuity",
] as const;
export type InsuranceSubtype = (typeof INSURANCE_SUBTYPES)[number];

export const insuranceSubtypeLabels: Record<InsuranceSubtype, string> = {
  term: "Term insurance — pure protection, no returns",
  endowment: "Endowment / savings plan — returns at maturity",
  market_linked: "Market-linked insurance plan — variable returns",
  child_education: "Child / education insurance — returns at target date",
  medical: "Medical / health insurance — pure protection, no returns",
  personal_accident: "Personal accident cover — pure protection, no returns",
  pension_annuity: "Pension / annuity plan — future monthly income",
};

export const insuranceDefaultReturns: Partial<Record<InsuranceSubtype, number>> = {
  endowment: 5,
  market_linked: 8,
  child_education: 7,
};

export function insuranceHasReturns(subtype?: InsuranceSubtype): boolean {
  return (
    subtype === "endowment" ||
    subtype === "market_linked" ||
    subtype === "child_education"
  );
}
export function insuranceIsAnnuity(subtype?: InsuranceSubtype): boolean {
  return subtype === "pension_annuity";
}
export function insuranceIsPureProtection(subtype?: InsuranceSubtype): boolean {
  return (
    subtype === "term" || subtype === "medical" || subtype === "personal_accident"
  );
}

export const investmentSchema = z.object({
  id: z.string(),
  type: z.enum(INVESTMENT_TYPES).default("monthly_market"),
  amount: num,
  // Frequency for recurring contributions / premiums (Change 8)
  frequency: z.enum(PAYMENT_FREQUENCIES).default("monthly"),
  assumedReturn: z.number().min(0).max(30).default(10),
  monthsRunning: z.number().int().min(0).max(600).default(0),
  continuing: z.boolean().default(true),
  monthsRemaining: z.number().int().min(0).max(600).default(12),
  // Insurance-specific fields (Change 6)
  insuranceSubtype: z.enum(INSURANCE_SUBTYPES).optional(),
  policyEndDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  maturityValue: num.optional(),
  maturityDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  annuityMonthlyIncome: num.optional(),
  annuityStartDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  excludeFromCorpus: z.boolean().default(false),
});
export type CurrentInvestment = z.infer<typeof investmentSchema>;
export const investmentsSchema = z.array(investmentSchema).max(10).default([]);

export function isLumpSumInvestment(type: InvestmentType): boolean {
  return type === "fixed_deposit";
}

// Monthly equivalent of a recurring contribution (uses frequency).
export function investmentMonthlyContribution(inv: CurrentInvestment): number {
  if (isLumpSumInvestment(inv.type)) return 0;
  // Pure-protection insurance still costs money but does not contribute to corpus
  return monthlyEquivalent(inv.amount, inv.frequency || "monthly");
}

// Insurance maturity events that arrive within the build-up window.
export function insuranceMaturityEvents(
  investments: CurrentInvestment[],
  windowMonths: number,
): Array<{
  id: string;
  subtype: InsuranceSubtype;
  amount: number;
  inMonth: number;
  date: string;
}> {
  const out: Array<{
    id: string;
    subtype: InsuranceSubtype;
    amount: number;
    inMonth: number;
    date: string;
  }> = [];
  for (const inv of investments) {
    if (inv.type !== "protection_plan") continue;
    if (!insuranceHasReturns(inv.insuranceSubtype)) continue;
    const m = monthsUntilEndDate(inv.maturityDate);
    if (m === null || m < 0 || m > windowMonths) continue;
    out.push({
      id: inv.id,
      subtype: inv.insuranceSubtype as InsuranceSubtype,
      amount: inv.maturityValue ?? 0,
      inMonth: m,
      date: inv.maturityDate as string,
    });
  }
  out.sort((a, b) => a.inMonth - b.inMonth);
  return out;
}

export function estimateInvestmentCurrentValue(investment: CurrentInvestment): number {
  // Pure-protection insurance contributes nothing to corpus
  if (investment.type === "protection_plan" && insuranceIsPureProtection(investment.insuranceSubtype))
    return 0;
  if (insuranceIsAnnuity(investment.insuranceSubtype)) return 0;
  if (isLumpSumInvestment(investment.type))
    return futureValueAmount(investment.amount, investment.assumedReturn, investment.monthsRunning);
  const monthly = investmentMonthlyContribution(investment);
  return futureValueSeries(monthly, investment.assumedReturn, investment.monthsRunning);
}

export function projectInvestmentValue(
  investment: CurrentInvestment,
  monthsToTarget: number,
): number {
  // Pure-protection insurance never adds to corpus
  if (investment.type === "protection_plan" && insuranceIsPureProtection(investment.insuranceSubtype))
    return 0;
  if (insuranceIsAnnuity(investment.insuranceSubtype)) return 0;

  // Insurance with returns: maturity value lands on its maturity date
  if (investment.type === "protection_plan" && insuranceHasReturns(investment.insuranceSubtype)) {
    const m = monthsUntilEndDate(investment.maturityDate);
    if (m === null) return 0;
    if (m > monthsToTarget) {
      // Discount-back to projected target date is irrelevant; if maturity is
      // beyond possession, only the value built up to possession at the assumed
      // return is counted (treat as a frozen growth instrument).
      return futureValueAmount(investment.maturityValue ?? 0, 0, 0);
    }
    return investment.maturityValue ?? 0;
  }

  const current = estimateInvestmentCurrentValue(investment);
  const months = Math.max(0, Math.round(monthsToTarget));
  const carried = futureValueAmount(current, investment.assumedReturn, months);
  if (!investment.continuing || isLumpSumInvestment(investment.type)) return carried;
  const monthly = investmentMonthlyContribution(investment);
  return (
    carried +
    futureValueSeries(
      monthly,
      investment.assumedReturn,
      Math.min(months, investment.monthsRemaining),
    )
  );
}

export function summarizeInvestments(investments: CurrentInvestment[], monthsToTarget: number) {
  return {
    monthlyCommitment: investments
      .filter((item) => !isLumpSumInvestment(item.type) && item.continuing)
      .reduce((sum, item) => sum + investmentMonthlyContribution(item), 0),
    currentCorpus: investments
      .filter((item) => !item.excludeFromCorpus)
      .reduce((sum, item) => sum + estimateInvestmentCurrentValue(item), 0),
    projectedCorpus: investments
      .filter((item) => !item.excludeFromCorpus)
      .reduce((sum, item) => sum + projectInvestmentValue(item, monthsToTarget), 0),
  };
}

// Maturity-aware corpus breakdown for possession date (Fix 3)
export function summarizeInvestmentsForPossession(
  investments: CurrentInvestment[],
  possessionMonths: number,
) {
  const availableAtPossession: Array<{
    inv: CurrentInvestment;
    value: number;
    status: "matured_before" | "accumulated" | "matured_after";
    maturityMonth: number | null;
  }> = [];

  let corpusAvailable = 0;
  let corpusAfterPossession = 0;

  for (const inv of investments) {
    if (inv.excludeFromCorpus) continue;
    // Pure protection — no corpus
    if (inv.type === "protection_plan" && insuranceIsPureProtection(inv.insuranceSubtype)) continue;
    if (insuranceIsAnnuity(inv.insuranceSubtype)) continue;

    // Insurance with returns — check maturity date
    if (inv.type === "protection_plan" && insuranceHasReturns(inv.insuranceSubtype)) {
      const m = monthsUntilEndDate(inv.maturityDate);
      if (m === null) continue;
      const maturityValue = inv.maturityValue ?? 0;
      if (m <= possessionMonths) {
        corpusAvailable += maturityValue;
        availableAtPossession.push({ inv, value: maturityValue, status: "matured_before", maturityMonth: m });
      } else {
        corpusAfterPossession += maturityValue;
        availableAtPossession.push({ inv, value: maturityValue, status: "matured_after", maturityMonth: m });
      }
      continue;
    }

    // Regular investments — check monthsRemaining
    const current = estimateInvestmentCurrentValue(inv);
    const totalMonths = possessionMonths;

    if (!inv.continuing || isLumpSumInvestment(inv.type)) {
      // Lump sum or stopped — just grows at assumed rate
      const projected = futureValueAmount(current, inv.assumedReturn, totalMonths);
      corpusAvailable += projected;
      availableAtPossession.push({ inv, value: projected, status: "matured_before", maturityMonth: null });
    } else {
      // Continuing investment
      const monthsContributing = Math.min(totalMonths, inv.monthsRemaining);
      const carried = futureValueAmount(current, inv.assumedReturn, totalMonths);
      const monthly = investmentMonthlyContribution(inv);
      const newContributions = futureValueSeries(monthly, inv.assumedReturn, monthsContributing);
      const totalValue = carried + newContributions;

      if (monthsContributing >= totalMonths) {
        // Still running at possession — show accumulated value
        corpusAvailable += totalValue;
        availableAtPossession.push({ inv, value: totalValue, status: "accumulated", maturityMonth: null });
      } else {
        // Matures before possession — full value available
        corpusAvailable += totalValue;
        availableAtPossession.push({ inv, value: totalValue, status: "matured_before", maturityMonth: monthsContributing });
      }
    }
  }

  return {
    corpusAvailable,
    corpusAfterPossession,
    items: availableAtPossession,
    monthlyCommitment: investments
      .filter((item) => !isLumpSumInvestment(item.type) && item.continuing)
      .reduce((sum, item) => sum + investmentMonthlyContribution(item), 0),
    currentCorpus: investments.reduce((sum, item) => sum + estimateInvestmentCurrentValue(item), 0),
  };
}
function futureValueSeries(monthly: number, annualRate: number, months: number) {
  let value = 0;
  const r = annualRate / 12 / 100;
  for (let month = 1; month <= Math.max(0, Math.round(months)); month += 1)
    value = (value + monthly) * (1 + r);
  return value;
}

function futureValueAmount(amount: number, annualRate: number, months: number) {
  return (amount || 0) * Math.pow(1 + annualRate / 12 / 100, Math.max(0, Math.round(months)));
}

export const EMPLOYMENT_TYPES = [
  "salaried_private",
  "salaried_government",
  "self_employed",
  "freelance",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const INCOME_STABILITY = ["very_stable", "mostly_stable", "variable"] as const;
export type IncomeStability = (typeof INCOME_STABILITY)[number];

export const EMERGENCY_FUND_PREFS = ["conservative", "balanced", "aggressive"] as const;
export type EmergencyFundPref = (typeof EMERGENCY_FUND_PREFS)[number];

export const profileSchema = z.object({
  dependents: z.number().int().min(0).max(6).default(0),
  elderlyParents: z.boolean().default(false),
  soleEarner: z.boolean().default(false),
  healthInsurance: z.boolean().default(true),
  termInsurance: z.boolean().default(false),
  hasUpcomingExpense: z.boolean().default(false),
  upcomingExpenseAmount: num,
  upcomingExpenseMonth: z.number().int().min(1).max(24).default(1),
  emergencyFundPref: z.enum(EMERGENCY_FUND_PREFS).default("balanced"),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("salaried_private"),
  incomeStability: z.enum(INCOME_STABILITY).default("very_stable"),
});
export type Profile = z.infer<typeof profileSchema>;

export const defaultProfile: Profile = {
  dependents: 0,
  elderlyParents: false,
  soleEarner: false,
  healthInsurance: true,
  termInsurance: false,
  hasUpcomingExpense: false,
  upcomingExpenseAmount: 0,
  upcomingExpenseMonth: 1,
  emergencyFundPref: "balanced",
  employmentType: "salaried_private",
  incomeStability: "very_stable",
};

export function recommendEmergencyFund(p: Profile): EmergencyFundPref {
  if (p.elderlyParents || p.soleEarner || !p.healthInsurance) return "conservative";
  return "balanced";
}

export type AffordabilityVerdict = "safe" | "stretch" | "risky";
export type EmergencyFundStatus = "Protected" | "Tight" | "At Risk";

export interface AffordabilityLayerScore {
  name: string;
  label: string;
  score: number;
}

export interface AffordabilityPlan {
  verdict: AffordabilityVerdict;
  headline: string;
  emergencyStatus: EmergencyFundStatus;
  totalIncome: number;
  totalFixed: number;
  newEmi: number;
  surplusBeforeEmi: number;
  surplusAfterEmi: number;
  emiToIncomePct: number;
  emergencyFundNeeded: number;
  layerScores: AffordabilityLayerScore[];
  // Fix 6: Pre/post possession outflow breakdown
  currentMonthlyOutflow: number; // pre-EMI / payment plan outflow now
  fullEmiAfterPossession: number;
  currentSurplus: number;
  surplusAfterPossession: number;
  isUnderConstruction: boolean;
}

function scoreByRatio(ratio: number, thresholds: Array<[number, number]>): number {
  const hit = thresholds.find(([min]) => ratio > min);
  return hit ? hit[1] : 0;
}

export function calculateAffordabilityPlan(
  finances: Finances,
  home: Home,
  profile: Profile,
): AffordabilityPlan {
  const income = totalIncome(finances);
  const fixed = totalOutflow(finances);
  const newEmi = calcEMI(loanAmount(home), home.interestRateA, home.tenureYears);
  const surplusBeforeEmi = income - fixed;
  const surplusAfterEmi = surplusBeforeEmi - newEmi;
  const emiToIncomePct = income > 0 ? (newEmi / income) * 100 : 0;
  const emergencyMonths =
    profile.emergencyFundPref === "conservative"
      ? 6
      : profile.emergencyFundPref === "balanced"
        ? 4
        : 2;
  const emergencyFundNeeded = emergencyMonths * (fixed / 2);
  const availableSavings = Math.max(
    0,
    (home.downPayment || 0) - (profile.hasUpcomingExpense ? profile.upcomingExpenseAmount || 0 : 0),
  );
  const emergencyCoverageRatio =
    emergencyFundNeeded > 0 ? availableSavings / emergencyFundNeeded : 2;
  const emergencyStatus: EmergencyFundStatus =
    emergencyCoverageRatio >= 1
      ? "Protected"
      : emergencyCoverageRatio >= 0.5 || surplusAfterEmi > 0
        ? "Tight"
        : "At Risk";

  const afterIncomeRatio = income > 0 ? surplusAfterEmi / income : 0;
  const verdict: AffordabilityVerdict =
    surplusAfterEmi < 0 || afterIncomeRatio < 0.05 || emergencyStatus === "At Risk"
      ? "risky"
      : afterIncomeRatio > 0.15 && emergencyStatus === "Protected"
        ? "safe"
        : "stretch";

  const headline =
    verdict === "safe"
      ? "Your finances comfortably support this home purchase."
      : verdict === "stretch"
        ? "This purchase is possible but will require careful monthly management."
        : "This purchase puts significant pressure on your monthly cash flow.";

  const essentialExpenses =
    totalCommitments(finances) +
    awfMonthly(finances.expenses.housing) +
    awfMonthly(finances.expenses.family) +
    awfMonthly(finances.expenses.health) +
    awfMonthly(finances.expenses.daily);
  const investmentRatio = surplusAfterEmi > 0 ? 2 : 0;

  // Fix 6: Pre/post possession breakdown
  const isUnderConstruction = home.propertyType === "construction";
  // For under-construction, the current outflow is pre-EMI interest on first disbursement
  // approximation: interest on (loanAmount / disbursementStages) for first tranche
  const loan = loanAmount(home);
  const stages = home.disbursementStages || 3;
  const preEmiInterest = isUnderConstruction
    ? (loan / stages) * (home.interestRateA / 12 / 100)
    : 0;
  const currentMonthlyOutflow = isUnderConstruction ? preEmiInterest : newEmi;
  const fullEmiAfterPossession = newEmi;
  const currentSurplus = isUnderConstruction
    ? totalIncome(finances) - totalExpenses(finances) - totalCommitments(finances, 0) - preEmiInterest
    : surplusAfterEmi;
  const possessionOffset = home.possessionMonth ?? 1;
  const surplusAfterPossession =
    totalIncome(finances)
    - totalExpenses(finances)
    - totalCommitments(finances, possessionOffset)
    - fullEmiAfterPossession;

  return {
    verdict,
    headline,
    emergencyStatus,
    totalIncome: income,
    totalFixed: fixed,
    newEmi,
    surplusBeforeEmi,
    surplusAfterEmi,
    emiToIncomePct,
    emergencyFundNeeded,
    currentMonthlyOutflow,
    fullEmiAfterPossession,
    currentSurplus,
    surplusAfterPossession,
    isUnderConstruction,
    layerScores: [
      {
        name: "Layer 1 — Survival Check",
        label: "Can your income cover essential expenses?",
        score: income > essentialExpenses ? 100 : 0,
      },
      {
        name: "Layer 2 — Liquidity Check",
        label: "Monthly cash flow after new EMI",
        score: scoreByRatio(afterIncomeRatio, [
          [0.2, 100],
          [0.15, 75],
          [0.1, 50],
          [0.05, 25],
        ]),
      },
      {
        name: "Layer 3 — Emergency Safety",
        label: "Emergency fund protection",
        score: scoreByRatio(emergencyCoverageRatio, [
          [2, 100],
          [1.5, 75],
          [1, 50],
          [0.5, 25],
        ]),
      },
      {
        name: "Layer 4 — Purchase Readiness",
        label: "Home loan affordability ratio",
        score:
          emiToIncomePct < 35
            ? 100
            : emiToIncomePct < 40
              ? 75
              : emiToIncomePct < 45
                ? 50
                : emiToIncomePct < 50
                  ? 25
                  : 0,
      },
      {
        name: "Layer 5 — Future Stability",
        label: "Monthly surplus after living costs and existing EMIs",
        score: scoreByRatio(investmentRatio, [
          [1, 100],
          [0.75, 75],
          [0.5, 50],
          [0.25, 25],
        ]),
      },
    ],
  };
}
