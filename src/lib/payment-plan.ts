// Payment plan types and calculation helpers for under-construction properties.
// Plans 1–5 as specified. Plans 6–9 reserved for future.

import { calcEMI, formatINR } from "./plan-schema";

export const PAYMENT_PLAN_TYPES = [
  "pre_emi",
  "full_emi_day1",
  "subvention",
  "fixed_emi_accumulated",
  "emi_holiday",
] as const;
export type PaymentPlanType = (typeof PAYMENT_PLAN_TYPES)[number];

export const paymentPlanLabels: Record<PaymentPlanType, string> = {
  pre_emi: "Standard Pre-EMI",
  full_emi_day1: "Full EMI From Day 1",
  subvention: "Subvention Scheme",
  fixed_emi_accumulated: "Fixed EMI with Accumulated Difference",
  emi_holiday: "EMI Holiday / Moratorium",
};

export interface Tranche {
  id: string;
  label: string;
  month: number; // months from today
  amount: number; // ₹
}

export interface PaymentPlanInputs {
  planType: PaymentPlanType;

  // Plan 1 & 2 & 4: tranches
  trancheCount: number; // 2-6
  tranches: Tranche[];
  interestRate: number; // annual %

  // Plan 3: subvention
  bookingAmount: number;
  builderEmiStartMonth: number;
  builderEmiAmount: number;

  // Plan 4: fixed EMI
  fixedEmiAmount: number;
  accumulatedDiffAction: "lump_sum" | "add_to_principal";

  // Plan 5: EMI holiday
  holidayMonths: number;

  // Shared
  loanAmount: number;
  tenureYears: number;
  possessionMonth: number;
}

export const defaultPaymentPlanInputs: PaymentPlanInputs = {
  planType: "pre_emi",
  trancheCount: 3,
  tranches: [],
  interestRate: 8.5,
  bookingAmount: 0,
  builderEmiStartMonth: 1,
  builderEmiAmount: 0,
  fixedEmiAmount: 0,
  accumulatedDiffAction: "lump_sum",
  holidayMonths: 6,
  loanAmount: 0,
  tenureYears: 20,
  possessionMonth: 1,
};

// Generate default equally-split tranches
export function generateDefaultTranches(
  count: number,
  totalLoan: number,
  possessionMonth: number,
): Tranche[] {
  const perTranche = Math.round(totalLoan / count);
  return Array.from({ length: count }, (_, i) => ({
    id: `t_${i}`,
    label: `Tranche ${i + 1}`,
    month: Math.max(1, Math.round(((i) / (count - 1 || 1)) * Math.max(1, possessionMonth - 1)) + 1),
    amount: i === count - 1 ? totalLoan - perTranche * (count - 1) : perTranche,
  }));
}

// ────────────────────────────────────────────────
// Plan 1 — Standard Pre-EMI schedule
// ────────────────────────────────────────────────
export interface PreEmiRow {
  month: number;
  disbursedSoFar: number;
  preEmi: number;
}

export function computePreEmiSchedule(
  tranches: Tranche[],
  interestRate: number,
  possessionMonth: number,
): { rows: PreEmiRow[]; totalPreEmi: number } {
  const sorted = [...tranches].sort((a, b) => a.month - b.month);
  const monthlyRate = interestRate / 12 / 100;
  const rows: PreEmiRow[] = [];
  let disbursed = 0;
  let totalPreEmi = 0;
  let trancheIdx = 0;

  for (let m = 1; m <= possessionMonth; m++) {
    while (trancheIdx < sorted.length && sorted[trancheIdx].month <= m) {
      disbursed += sorted[trancheIdx].amount;
      trancheIdx++;
    }
    const preEmi = disbursed * monthlyRate;
    totalPreEmi += preEmi;
    // Only add rows at tranche months and last month for brevity
    if (
      m === 1 ||
      sorted.some((t) => t.month === m) ||
      m === possessionMonth
    ) {
      rows.push({ month: m, disbursedSoFar: disbursed, preEmi });
    }
  }

  return { rows, totalPreEmi };
}

// ────────────────────────────────────────────────
// Plan 2 — Full EMI from Day 1 comparison
// ────────────────────────────────────────────────
export interface FullEmiComparison {
  fullEmi: number;
  preEmiNow: number; // first month pre-EMI
  preEmiAtPossession: number; // full EMI after possession for plan 1
  principalAtPossessionPreEmi: number;
  principalAtPossessionFullEmi: number;
  totalInterestPreEmi: number;
  totalInterestFullEmi: number;
  interestSaved: number;
}

export function computeFullEmiComparison(
  tranches: Tranche[],
  loanAmount: number,
  interestRate: number,
  tenureYears: number,
  possessionMonth: number,
): FullEmiComparison {
  const fullEmi = calcEMI(loanAmount, interestRate, tenureYears);
  const preEmi = computePreEmiSchedule(tranches, interestRate, possessionMonth);
  const preEmiNow = preEmi.rows[0]?.preEmi ?? 0;
  const preEmiAtPossession = fullEmi;

  // For full EMI from day 1: principal paid down during construction
  const monthlyRate = interestRate / 12 / 100;
  let principalRemaining = loanAmount;
  let totalInterestFull = 0;
  const totalMonths = tenureYears * 12;

  for (let m = 1; m <= totalMonths; m++) {
    const interest = principalRemaining * monthlyRate;
    const principalPart = fullEmi - interest;
    totalInterestFull += interest;
    principalRemaining -= principalPart;
  }
  const principalAtPossessionFullEmi = (() => {
    let p = loanAmount;
    for (let m = 1; m <= possessionMonth; m++) {
      const interest = p * monthlyRate;
      p -= (fullEmi - interest);
    }
    return Math.max(0, p);
  })();

  // Pre-EMI: no principal paid during construction
  const totalInterestPreEmi = preEmi.totalPreEmi + (() => {
    let p = loanAmount;
    let total = 0;
    for (let m = 1; m <= totalMonths; m++) {
      const interest = p * monthlyRate;
      total += interest;
      p -= (fullEmi - interest);
    }
    return total;
  })();

  return {
    fullEmi,
    preEmiNow,
    preEmiAtPossession,
    principalAtPossessionPreEmi: loanAmount,
    principalAtPossessionFullEmi,
    totalInterestPreEmi,
    totalInterestFullEmi: totalInterestFull,
    interestSaved: totalInterestPreEmi - totalInterestFull,
  };
}

// ────────────────────────────────────────────────
// Plan 4 — Fixed EMI with accumulated difference
// ────────────────────────────────────────────────
export interface AccumulatedDiffRow {
  month: number;
  interestDue: number;
  youPay: number;
  accumulated: number;
}

export function computeAccumulatedDiff(
  tranches: Tranche[],
  fixedEmi: number,
  interestRate: number,
  possessionMonth: number,
): { rows: AccumulatedDiffRow[]; totalAccumulated: number } {
  const sorted = [...tranches].sort((a, b) => a.month - b.month);
  const monthlyRate = interestRate / 12 / 100;
  let disbursed = 0;
  let accumulated = 0;
  let trancheIdx = 0;
  const rows: AccumulatedDiffRow[] = [];

  for (let m = 1; m <= possessionMonth; m++) {
    while (trancheIdx < sorted.length && sorted[trancheIdx].month <= m) {
      disbursed += sorted[trancheIdx].amount;
      trancheIdx++;
    }
    const interestDue = disbursed * monthlyRate;
    const diff = Math.max(0, interestDue - fixedEmi);
    accumulated += diff;

    if (
      m === 1 ||
      m === 6 ||
      sorted.some((t) => t.month === m) ||
      m === possessionMonth
    ) {
      rows.push({ month: m, interestDue, youPay: fixedEmi, accumulated });
    }
  }

  return { rows, totalAccumulated: accumulated };
}

// ────────────────────────────────────────────────
// Plan 5 — EMI Holiday / Moratorium
// ────────────────────────────────────────────────
export interface HolidayRow {
  month: number;
  interestAccruing: number;
  runningTotal: number;
}

export function computeEmiHoliday(
  loanAmount: number,
  interestRate: number,
  holidayMonths: number,
  tenureYears: number,
): {
  rows: HolidayRow[];
  totalAccrued: number;
  revisedPrincipal: number;
  revisedEmi: number;
  originalEmi: number;
} {
  const monthlyRate = interestRate / 12 / 100;
  let principal = loanAmount;
  let totalAccrued = 0;
  const rows: HolidayRow[] = [];

  for (let m = 1; m <= holidayMonths; m++) {
    const interest = principal * monthlyRate;
    totalAccrued += interest;
    principal += interest; // interest capitalizes

    if (m === 1 || m === 6 || m === holidayMonths) {
      rows.push({ month: m, interestAccruing: interest, runningTotal: totalAccrued });
    }
  }

  const revisedPrincipal = principal;
  const remainingTenure = tenureYears - holidayMonths / 12;
  const revisedEmi = calcEMI(revisedPrincipal, interestRate, Math.max(1, remainingTenure));
  const originalEmi = calcEMI(loanAmount, interestRate, tenureYears);

  return { rows, totalAccrued, revisedPrincipal, revisedEmi, originalEmi };
}

// ────────────────────────────────────────────────
// Monthly outflow for any plan at a given month offset
// Used by downstream corpus builder / affordability
// ────────────────────────────────────────────────
export function monthlyPaymentAtOffset(
  plan: PaymentPlanInputs,
  monthOffset: number,
): number {
  const r = plan.interestRate / 12 / 100;
  const fullEmi = calcEMI(plan.loanAmount, plan.interestRate, plan.tenureYears);

  switch (plan.planType) {
    case "pre_emi": {
      if (monthOffset >= plan.possessionMonth) return fullEmi;
      const sorted = [...plan.tranches].sort((a, b) => a.month - b.month);
      let disbursed = 0;
      for (const t of sorted) {
        if (t.month <= monthOffset) disbursed += t.amount;
      }
      return disbursed * r;
    }
    case "full_emi_day1":
      return fullEmi;
    case "subvention":
      return monthOffset >= plan.possessionMonth ? fullEmi : 0;
    case "fixed_emi_accumulated":
      return monthOffset >= plan.possessionMonth ? fullEmi : plan.fixedEmiAmount;
    case "emi_holiday":
      return monthOffset <= plan.holidayMonths ? 0 : fullEmi;
    default:
      return fullEmi;
  }
}

// Format month offset to "Month X — MMM YYYY"
export function formatMonthLabel(monthOffset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset - 1);
  const mmm = d.toLocaleString("en-IN", { month: "short" });
  const yyyy = d.getFullYear();
  return `Month ${monthOffset} — ${mmm} ${yyyy}`;
}
