import { z } from "zod";

const num = z.number().min(0).default(0);

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
  interestRateA: z.number().min(0).max(50).default(8.5),
  interestRateB: z.number().min(0).max(50).optional(),
  tenureYears: z.number().int().min(1).max(40).default(20),
  builderStages: z.array(builderStageSchema).default([]),
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
  interestRateA: 8.5,
  interestRateB: undefined,
  tenureYears: 20,
  builderStages: [
    { id: "s1", name: "Stage 1", month: 1, bankPays: 0, youPay: 0 },
    { id: "s2", name: "Stage 2", month: 13, bankPays: 0, youPay: 0 },
  ],
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
    emis: num,
    insurance: num,
  }),
  expenses: z
    .object({
      housing: num,
      family: num,
      health: num,
      daily: num,
      schoolFees: num,
      discretionary: num,
      // Backward compat: accept legacy "investments" key from saved plans
      investments: num.optional(),
    })
    .transform((v) => {
      const { investments, ...rest } = v;
      if ((rest.schoolFees ?? 0) === 0 && typeof investments === "number" && investments > 0) {
        return { ...rest, schoolFees: investments } as {
          housing: number;
          family: number;
          health: number;
          daily: number;
          schoolFees: number;
          discretionary: number;
        };
      }
      return rest as {
        housing: number;
        family: number;
        health: number;
        daily: number;
        schoolFees: number;
        discretionary: number;
      };
    }),
});

export type Finances = z.infer<typeof financesSchema>;

export const defaultFinances: Finances = {
  income: { primarySalary: 0, additionalIncome: 0, familyContribution: 0 },
  commitments: { emis: 0, insurance: 0 },
  expenses: {
    housing: 0,
    family: 0,
    health: 0,
    daily: 0,
    investments: 0,
    discretionary: 0,
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

export function totalCommitments(f: Finances): number {
  return safeNumber(f.commitments.emis);
}

export function totalExpenses(f: Finances): number {
  const e = f.expenses;
  return (
    safeNumber(e.housing) +
    safeNumber(e.family) +
    safeNumber(e.health) +
    safeNumber(e.daily) +
    safeNumber(e.discretionary)
  );
}

export function totalOutflow(f: Finances): number {
  return totalCommitments(f) + totalExpenses(f);
}

export function surplus(f: Finances): number {
  const value = totalIncome(f) - totalOutflow(f);
  return Number.isFinite(value) ? value : 0;
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

export const investmentSchema = z.object({
  id: z.string(),
  type: z.enum(INVESTMENT_TYPES).default("monthly_market"),
  amount: num,
  assumedReturn: z.number().min(0).max(30).default(10),
  monthsRunning: z.number().int().min(0).max(600).default(0),
  continuing: z.boolean().default(true),
  monthsRemaining: z.number().int().min(0).max(600).default(12),
});
export type CurrentInvestment = z.infer<typeof investmentSchema>;
export const investmentsSchema = z.array(investmentSchema).max(10).default([]);

export function isLumpSumInvestment(type: InvestmentType): boolean {
  return type === "fixed_deposit";
}

export function estimateInvestmentCurrentValue(investment: CurrentInvestment): number {
  if (isLumpSumInvestment(investment.type))
    return futureValueAmount(investment.amount, investment.assumedReturn, investment.monthsRunning);
  return futureValueSeries(investment.amount, investment.assumedReturn, investment.monthsRunning);
}

export function projectInvestmentValue(
  investment: CurrentInvestment,
  monthsToTarget: number,
): number {
  const current = estimateInvestmentCurrentValue(investment);
  const months = Math.max(0, Math.round(monthsToTarget));
  const carried = futureValueAmount(current, investment.assumedReturn, months);
  if (!investment.continuing || isLumpSumInvestment(investment.type)) return carried;
  return (
    carried +
    futureValueSeries(
      investment.amount,
      investment.assumedReturn,
      Math.min(months, investment.monthsRemaining),
    )
  );
}

export function summarizeInvestments(investments: CurrentInvestment[], monthsToTarget: number) {
  return {
    monthlyCommitment: investments
      .filter((item) => !isLumpSumInvestment(item.type) && item.continuing)
      .reduce((sum, item) => sum + (item.amount || 0), 0),
    currentCorpus: investments.reduce((sum, item) => sum + estimateInvestmentCurrentValue(item), 0),
    projectedCorpus: investments.reduce(
      (sum, item) => sum + projectInvestmentValue(item, monthsToTarget),
      0,
    ),
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
    (finances.expenses.housing || 0) +
    (finances.expenses.family || 0) +
    (finances.expenses.health || 0) +
    (finances.expenses.daily || 0);
  const investmentRatio = surplusAfterEmi > 0 ? 2 : 0;

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
