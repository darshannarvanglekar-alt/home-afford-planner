import { z } from "zod";

const num = z.number().min(0).default(0);

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
