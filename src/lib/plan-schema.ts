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
  return Math.max(0, (h.propertyCost || 0) - (h.downPayment || 0));
}

export function calcEMI(principal: number, annualRatePct: number, tenureYears: number): number {
  if (!principal || principal <= 0) return 0;
  if (!tenureYears || tenureYears <= 0) return 0;
  const n = tenureYears * 12;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / n;
  const pow = Math.pow(1 + r, n);
  return (principal * r * pow) / (pow - 1);
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
  expenses: z.object({
    housing: num,
    family: num,
    health: num,
    daily: num,
    investments: num,
    discretionary: num,
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
  return (i.primarySalary || 0) + (i.additionalIncome || 0) + (i.familyContribution || 0);
}

export function totalCommitments(f: Finances): number {
  const c = f.commitments;
  return (c.emis || 0) + (c.insurance || 0);
}

export function totalExpenses(f: Finances): number {
  const e = f.expenses;
  return (
    (e.housing || 0) +
    (e.family || 0) +
    (e.health || 0) +
    (e.daily || 0) +
    (e.investments || 0) +
    (e.discretionary || 0)
  );
}

export function totalOutflow(f: Finances): number {
  return totalCommitments(f) + totalExpenses(f);
}

export function surplus(f: Finances): number {
  return totalIncome(f) - totalOutflow(f);
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
