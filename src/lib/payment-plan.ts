// Payment plan types and calculation helpers for under-construction properties.
// Plans 1–9 as specified.

import { calcEMI, formatINR } from "./plan-schema";

export const PAYMENT_PLAN_TYPES = [
  "pre_emi",
  "full_emi_day1",
  "subvention",
  "fixed_emi_accumulated",
  "emi_holiday",
  "step_up_emi",
  "step_down_emi",
  "possession_date_start",
  "custom_plan",
] as const;
export type PaymentPlanType = (typeof PAYMENT_PLAN_TYPES)[number];

export const paymentPlanLabels: Record<PaymentPlanType, string> = {
  pre_emi: "Standard Pre-EMI",
  full_emi_day1: "Full EMI From Day 1",
  subvention: "Subvention Scheme",
  fixed_emi_accumulated: "Fixed EMI with Accumulated Difference",
  emi_holiday: "EMI Holiday / Moratorium",
  step_up_emi: "Step-Up EMI",
  step_down_emi: "Step-Down EMI",
  possession_date_start: "Possession-Date EMI Start",
  custom_plan: "Custom Plan",
};

export interface Tranche {
  id: string;
  label: string;
  month: number; // months from today
  amount: number; // ₹
}

// ── Plan 6 — Step-Up EMI ──
export interface StepUpConfig {
  startingEmi: number;
  stepType: "fixed" | "percentage";
  stepAmount: number; // ₹ or %
  stepFrequencyYears: 1 | 2 | 3;
  stepPeriods: number; // 1-10
}

// ── Plan 7 — Step-Down EMI ──
export interface StepDownConfig {
  startingEmi: number;
  stepType: "fixed" | "percentage";
  stepAmount: number;
  stepFrequencyYears: 1 | 2 | 3;
  stepPeriods: number;
}

// ── Plan 8 — Possession-Date EMI Start ──
export interface PossessionStartConfig {
  accruedAction: "add_to_principal" | "lump_sum";
}

// ── Plan 9 — Custom Plan ──
export interface CustomMilestone {
  id: string;
  fromMonth: number;
  amount: number;
}
export interface CustomChangePoint {
  id: string;
  fromMonthAfterPossession: number;
  newEmi: number;
}
export interface CustomPlanConfig {
  // Phase A
  phaseAType: "fixed" | "milestone";
  phaseAFixedAmount: number;
  phaseAMilestones: CustomMilestone[];
  phaseAThirdPartyPays: boolean;
  phaseAThirdPartyLabel: string;
  phaseAThirdPartyAmount: number;
  phaseAThirdPartyFromMonth: number;
  phaseAThirdPartyToMonth: number;
  // Phase B
  phaseBLumpSum: boolean;
  phaseBLumpSumAmount: number;
  phaseBLumpSumLabel: string;
  phaseBAddToPrincipal: boolean;
  phaseBAddAmount: number;
  // Phase C
  phaseCAutoEmi: boolean;
  phaseCManualEmi: number;
  phaseCChanges: boolean;
  phaseCChangeType: "increase_pct" | "decrease_pct" | "custom";
  phaseCChangePct: number;
  phaseCChangePoints: CustomChangePoint[];
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

  // Plan 6
  stepUp: StepUpConfig;

  // Plan 7
  stepDown: StepDownConfig;

  // Plan 8
  possessionStart: PossessionStartConfig;

  // Plan 9
  customPlan: CustomPlanConfig;

  // Shared
  loanAmount: number;
  tenureYears: number;
  possessionMonth: number;
}

export const defaultStepUpConfig: StepUpConfig = {
  startingEmi: 0,
  stepType: "fixed",
  stepAmount: 5000,
  stepFrequencyYears: 1,
  stepPeriods: 5,
};

export const defaultStepDownConfig: StepDownConfig = {
  startingEmi: 0,
  stepType: "fixed",
  stepAmount: 5000,
  stepFrequencyYears: 1,
  stepPeriods: 5,
};

export const defaultPossessionStartConfig: PossessionStartConfig = {
  accruedAction: "add_to_principal",
};

export const defaultCustomPlanConfig: CustomPlanConfig = {
  phaseAType: "fixed",
  phaseAFixedAmount: 0,
  phaseAMilestones: [],
  phaseAThirdPartyPays: false,
  phaseAThirdPartyLabel: "",
  phaseAThirdPartyAmount: 0,
  phaseAThirdPartyFromMonth: 1,
  phaseAThirdPartyToMonth: 12,
  phaseBLumpSum: false,
  phaseBLumpSumAmount: 0,
  phaseBLumpSumLabel: "",
  phaseBAddToPrincipal: false,
  phaseBAddAmount: 0,
  phaseCAutoEmi: true,
  phaseCManualEmi: 0,
  phaseCChanges: false,
  phaseCChangeType: "increase_pct",
  phaseCChangePct: 5,
  phaseCChangePoints: [],
};

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
  stepUp: defaultStepUpConfig,
  stepDown: defaultStepDownConfig,
  possessionStart: defaultPossessionStartConfig,
  customPlan: defaultCustomPlanConfig,
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
  preEmiNow: number;
  preEmiAtPossession: number;
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
    principal += interest;

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
// Plan 6 — Step-Up EMI schedule
// ────────────────────────────────────────────────
export interface StepScheduleRow {
  period: number;
  yearLabel: string;
  monthlyEmi: number;
}

export function computeStepUpSchedule(
  cfg: StepUpConfig,
  loanAmount: number,
  interestRate: number,
  tenureYears: number,
): { rows: StepScheduleRow[]; totalInterest: number; standardTotalInterest: number } {
  const rows: StepScheduleRow[] = [];
  let emi = cfg.startingEmi;
  const totalMonths = tenureYears * 12;
  const monthlyRate = interestRate / 12 / 100;
  const standardEmi = calcEMI(loanAmount, interestRate, tenureYears);

  // Build period schedule
  for (let p = 0; p <= cfg.stepPeriods; p++) {
    const startYear = p * cfg.stepFrequencyYears + 1;
    const endYear = p < cfg.stepPeriods
      ? (p + 1) * cfg.stepFrequencyYears
      : tenureYears;
    rows.push({
      period: p + 1,
      yearLabel: p < cfg.stepPeriods
        ? `Year ${startYear}–${endYear}`
        : `Year ${startYear}+`,
      monthlyEmi: Math.round(emi),
    });
    if (p < cfg.stepPeriods) {
      emi = cfg.stepType === "fixed"
        ? emi + cfg.stepAmount
        : emi * (1 + cfg.stepAmount / 100);
    }
  }

  // Calculate total interest for step-up
  let principal = loanAmount;
  let totalInterest = 0;
  let currentEmi = cfg.startingEmi;
  let periodStart = 0;
  for (let m = 1; m <= totalMonths && principal > 0; m++) {
    const periodIdx = Math.floor((m - 1) / (cfg.stepFrequencyYears * 12));
    if (periodIdx !== periodStart) {
      for (let s = periodStart; s < periodIdx; s++) {
        currentEmi = cfg.stepType === "fixed"
          ? currentEmi + cfg.stepAmount
          : currentEmi * (1 + cfg.stepAmount / 100);
      }
      periodStart = periodIdx;
    }
    // After all step-ups, EMI stabilises
    const interest = principal * monthlyRate;
    const payment = Math.min(currentEmi, principal + interest);
    totalInterest += interest;
    principal -= (payment - interest);
  }

  // Standard total interest
  let stdPrincipal = loanAmount;
  let standardTotalInterest = 0;
  for (let m = 1; m <= totalMonths && stdPrincipal > 0; m++) {
    const interest = stdPrincipal * monthlyRate;
    standardTotalInterest += interest;
    stdPrincipal -= (standardEmi - interest);
  }

  return { rows, totalInterest, standardTotalInterest };
}

// ────────────────────────────────────────────────
// Plan 7 — Step-Down EMI schedule
// ────────────────────────────────────────────────
export function computeStepDownSchedule(
  cfg: StepDownConfig,
  loanAmount: number,
  interestRate: number,
  tenureYears: number,
): { rows: StepScheduleRow[]; totalInterest: number; standardTotalInterest: number } {
  const rows: StepScheduleRow[] = [];
  let emi = cfg.startingEmi;
  const totalMonths = tenureYears * 12;
  const monthlyRate = interestRate / 12 / 100;
  const standardEmi = calcEMI(loanAmount, interestRate, tenureYears);
  const minEmi = loanAmount * monthlyRate; // at least interest-only

  for (let p = 0; p <= cfg.stepPeriods; p++) {
    const startYear = p * cfg.stepFrequencyYears + 1;
    const endYear = p < cfg.stepPeriods
      ? (p + 1) * cfg.stepFrequencyYears
      : tenureYears;
    rows.push({
      period: p + 1,
      yearLabel: p < cfg.stepPeriods
        ? `Year ${startYear}–${endYear}`
        : `Year ${startYear}+`,
      monthlyEmi: Math.round(Math.max(emi, minEmi)),
    });
    if (p < cfg.stepPeriods) {
      emi = cfg.stepType === "fixed"
        ? emi - cfg.stepAmount
        : emi * (1 - cfg.stepAmount / 100);
      emi = Math.max(emi, minEmi);
    }
  }

  // Calculate total interest for step-down
  let principal = loanAmount;
  let totalInterest = 0;
  let currentEmi = cfg.startingEmi;
  let periodStart = 0;
  for (let m = 1; m <= totalMonths && principal > 0; m++) {
    const periodIdx = Math.floor((m - 1) / (cfg.stepFrequencyYears * 12));
    if (periodIdx !== periodStart) {
      for (let s = periodStart; s < periodIdx; s++) {
        currentEmi = cfg.stepType === "fixed"
          ? currentEmi - cfg.stepAmount
          : currentEmi * (1 - cfg.stepAmount / 100);
        currentEmi = Math.max(currentEmi, minEmi);
      }
      periodStart = periodIdx;
    }
    const interest = principal * monthlyRate;
    const payment = Math.min(Math.max(currentEmi, interest), principal + interest);
    totalInterest += interest;
    principal -= (payment - interest);
  }

  let stdPrincipal = loanAmount;
  let standardTotalInterest = 0;
  for (let m = 1; m <= totalMonths && stdPrincipal > 0; m++) {
    const interest = stdPrincipal * monthlyRate;
    standardTotalInterest += interest;
    stdPrincipal -= (standardEmi - interest);
  }

  return { rows, totalInterest, standardTotalInterest };
}

// ────────────────────────────────────────────────
// Plan 8 — Possession-Date EMI Start
// ────────────────────────────────────────────────
export interface PossessionAccrualRow {
  month: number;
  monthlyInterest: number;
  totalAccrued: number;
}

export function computePossessionDateAccrual(
  loanAmount: number,
  interestRate: number,
  possessionMonth: number,
): { rows: PossessionAccrualRow[]; totalAccrued: number } {
  const monthlyRate = interestRate / 12 / 100;
  const monthlyInterest = loanAmount * monthlyRate;
  let totalAccrued = 0;
  const rows: PossessionAccrualRow[] = [];

  for (let m = 1; m <= possessionMonth; m++) {
    totalAccrued += monthlyInterest;
    if (m === 1 || m === 6 || m === 12 || m === possessionMonth || m % 12 === 0) {
      rows.push({ month: m, monthlyInterest, totalAccrued });
    }
  }

  return { rows, totalAccrued };
}

// ────────────────────────────────────────────────
// Plan comparison helper — compare any plan vs Pre-EMI
// ────────────────────────────────────────────────
export interface PlanComparisonRow {
  label: string;
  yourPlan: string;
  preEmi: string;
  yourPlanBetter: boolean | null; // null = equal
}

export function computePlanComparison(
  plan: PaymentPlanInputs,
): PlanComparisonRow[] {
  const fullEmi = calcEMI(plan.loanAmount, plan.interestRate, plan.tenureYears);
  const monthlyRate = plan.interestRate / 12 / 100;
  const totalMonths = plan.tenureYears * 12;

  // Pre-EMI baseline (assume full loan disbursed at month 1 for simplicity)
  const preEmiMonthly = plan.loanAmount * monthlyRate;
  const preEmiTotalBefore = preEmiMonthly * plan.possessionMonth;
  const preEmiTotalInterest = preEmiTotalBefore + computeStandardTotalInterest(plan.loanAmount, plan.interestRate, plan.tenureYears);

  // Your plan
  let yourMonthlyNow = 0;
  let yourTotalBefore = 0;
  let yourLumpSum = 0;
  let yourEmiAfter = fullEmi;
  let yourTotalInterest = 0;

  switch (plan.planType) {
    case "step_up_emi": {
      yourMonthlyNow = plan.stepUp.startingEmi;
      const result = computeStepUpSchedule(plan.stepUp, plan.loanAmount, plan.interestRate, plan.tenureYears);
      yourTotalInterest = result.totalInterest;
      yourTotalBefore = yourMonthlyNow * plan.possessionMonth;
      yourEmiAfter = result.rows[result.rows.length - 1]?.monthlyEmi ?? fullEmi;
      break;
    }
    case "step_down_emi": {
      yourMonthlyNow = plan.stepDown.startingEmi;
      const result = computeStepDownSchedule(plan.stepDown, plan.loanAmount, plan.interestRate, plan.tenureYears);
      yourTotalInterest = result.totalInterest;
      yourTotalBefore = yourMonthlyNow * plan.possessionMonth;
      yourEmiAfter = result.rows[result.rows.length - 1]?.monthlyEmi ?? fullEmi;
      break;
    }
    case "possession_date_start": {
      yourMonthlyNow = 0;
      const accrual = computePossessionDateAccrual(plan.loanAmount, plan.interestRate, plan.possessionMonth);
      yourTotalBefore = 0;
      if (plan.possessionStart.accruedAction === "add_to_principal") {
        const revised = plan.loanAmount + accrual.totalAccrued;
        yourEmiAfter = calcEMI(revised, plan.interestRate, plan.tenureYears);
        yourTotalInterest = accrual.totalAccrued + computeStandardTotalInterest(revised, plan.interestRate, plan.tenureYears);
      } else {
        yourLumpSum = accrual.totalAccrued;
        yourEmiAfter = fullEmi;
        yourTotalInterest = accrual.totalAccrued + computeStandardTotalInterest(plan.loanAmount, plan.interestRate, plan.tenureYears);
      }
      break;
    }
    case "custom_plan": {
      const cp = plan.customPlan;
      yourMonthlyNow = cp.phaseAType === "fixed" ? cp.phaseAFixedAmount : (cp.phaseAMilestones[0]?.amount ?? 0);
      yourTotalBefore = cp.phaseAType === "fixed"
        ? cp.phaseAFixedAmount * plan.possessionMonth
        : cp.phaseAMilestones.reduce((s, m) => s + m.amount, 0);
      yourLumpSum = cp.phaseBLumpSum ? cp.phaseBLumpSumAmount : 0;
      yourEmiAfter = cp.phaseCAutoEmi ? fullEmi : cp.phaseCManualEmi;
      yourTotalInterest = computeStandardTotalInterest(plan.loanAmount, plan.interestRate, plan.tenureYears);
      break;
    }
    default:
      return [];
  }

  const rows: PlanComparisonRow[] = [
    {
      label: "Monthly payment now",
      yourPlan: formatINR(yourMonthlyNow),
      preEmi: formatINR(preEmiMonthly),
      yourPlanBetter: yourMonthlyNow < preEmiMonthly ? true : yourMonthlyNow > preEmiMonthly ? false : null,
    },
    {
      label: "Total paid before possession",
      yourPlan: formatINR(yourTotalBefore),
      preEmi: formatINR(preEmiTotalBefore),
      yourPlanBetter: yourTotalBefore < preEmiTotalBefore ? true : yourTotalBefore > preEmiTotalBefore ? false : null,
    },
  ];

  if (yourLumpSum > 0) {
    rows.push({
      label: "Lump sum at possession",
      yourPlan: formatINR(yourLumpSum),
      preEmi: "N/A",
      yourPlanBetter: false,
    });
  }

  rows.push(
    {
      label: "EMI after possession",
      yourPlan: formatINR(yourEmiAfter),
      preEmi: formatINR(fullEmi),
      yourPlanBetter: yourEmiAfter < fullEmi ? true : yourEmiAfter > fullEmi ? false : null,
    },
    {
      label: "Total interest payable",
      yourPlan: formatINR(yourTotalInterest),
      preEmi: formatINR(preEmiTotalInterest),
      yourPlanBetter: yourTotalInterest < preEmiTotalInterest ? true : yourTotalInterest > preEmiTotalInterest ? false : null,
    },
  );

  return rows;
}

function computeStandardTotalInterest(loanAmount: number, interestRate: number, tenureYears: number): number {
  const emi = calcEMI(loanAmount, interestRate, tenureYears);
  const monthlyRate = interestRate / 12 / 100;
  const totalMonths = tenureYears * 12;
  let principal = loanAmount;
  let totalInterest = 0;
  for (let m = 1; m <= totalMonths && principal > 0; m++) {
    const interest = principal * monthlyRate;
    totalInterest += interest;
    principal -= (emi - interest);
  }
  return totalInterest;
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
    case "step_up_emi": {
      const cfg = plan.stepUp;
      const periodIdx = Math.floor((monthOffset - 1) / (cfg.stepFrequencyYears * 12));
      let emi = cfg.startingEmi;
      for (let p = 0; p < Math.min(periodIdx, cfg.stepPeriods); p++) {
        emi = cfg.stepType === "fixed" ? emi + cfg.stepAmount : emi * (1 + cfg.stepAmount / 100);
      }
      return emi;
    }
    case "step_down_emi": {
      const cfg = plan.stepDown;
      const minEmi = plan.loanAmount * r;
      const periodIdx = Math.floor((monthOffset - 1) / (cfg.stepFrequencyYears * 12));
      let emi = cfg.startingEmi;
      for (let p = 0; p < Math.min(periodIdx, cfg.stepPeriods); p++) {
        emi = cfg.stepType === "fixed" ? emi - cfg.stepAmount : emi * (1 - cfg.stepAmount / 100);
        emi = Math.max(emi, minEmi);
      }
      return Math.max(emi, minEmi);
    }
    case "possession_date_start":
      return monthOffset >= plan.possessionMonth
        ? (plan.possessionStart.accruedAction === "add_to_principal"
          ? calcEMI(plan.loanAmount + plan.loanAmount * r * plan.possessionMonth, plan.interestRate, plan.tenureYears)
          : fullEmi)
        : 0;
    case "custom_plan": {
      const cp = plan.customPlan;
      if (monthOffset < plan.possessionMonth) {
        // Before possession
        if (cp.phaseAType === "fixed") return cp.phaseAFixedAmount;
        // Milestone-based: find the active milestone
        const sorted = [...cp.phaseAMilestones].sort((a, b) => a.fromMonth - b.fromMonth);
        let amount = 0;
        for (const ms of sorted) {
          if (monthOffset >= ms.fromMonth) amount = ms.amount;
        }
        return amount;
      }
      // After possession
      const baseEmi = cp.phaseCAutoEmi ? fullEmi : cp.phaseCManualEmi;
      if (!cp.phaseCChanges) return baseEmi;
      const monthsAfter = monthOffset - plan.possessionMonth;
      if (cp.phaseCChangeType === "custom") {
        const sorted = [...cp.phaseCChangePoints].sort((a, b) => a.fromMonthAfterPossession - b.fromMonthAfterPossession);
        let emi = baseEmi;
        for (const pt of sorted) {
          if (monthsAfter >= pt.fromMonthAfterPossession) emi = pt.newEmi;
        }
        return emi;
      }
      const yearsAfter = Math.floor(monthsAfter / 12);
      const mult = cp.phaseCChangeType === "increase_pct"
        ? Math.pow(1 + cp.phaseCChangePct / 100, yearsAfter)
        : Math.pow(1 - cp.phaseCChangePct / 100, yearsAfter);
      return baseEmi * mult;
    }
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

// ────────────────────────────────────────────────
// Plan metrics summary for AI suggestions
// ────────────────────────────────────────────────
export function getPlanMetricsForAI(plan: PaymentPlanInputs): {
  planType: string;
  planLabel: string;
  monthlyPaymentNow: number;
  emiAfterPossession: number;
  totalInterestEstimate: number;
  lumpSumAtPossession: number;
} {
  const fullEmi = calcEMI(plan.loanAmount, plan.interestRate, plan.tenureYears);
  const monthlyNow = monthlyPaymentAtOffset(plan, 1);
  let totalInterest = computeStandardTotalInterest(plan.loanAmount, plan.interestRate, plan.tenureYears);
  let lumpSum = 0;
  let emiAfter = fullEmi;

  switch (plan.planType) {
    case "step_up_emi": {
      const r = computeStepUpSchedule(plan.stepUp, plan.loanAmount, plan.interestRate, plan.tenureYears);
      totalInterest = r.totalInterest;
      break;
    }
    case "step_down_emi": {
      const r = computeStepDownSchedule(plan.stepDown, plan.loanAmount, plan.interestRate, plan.tenureYears);
      totalInterest = r.totalInterest;
      break;
    }
    case "possession_date_start": {
      const accrual = computePossessionDateAccrual(plan.loanAmount, plan.interestRate, plan.possessionMonth);
      if (plan.possessionStart.accruedAction === "add_to_principal") {
        const revised = plan.loanAmount + accrual.totalAccrued;
        emiAfter = calcEMI(revised, plan.interestRate, plan.tenureYears);
        totalInterest = accrual.totalAccrued + computeStandardTotalInterest(revised, plan.interestRate, plan.tenureYears);
      } else {
        lumpSum = accrual.totalAccrued;
        totalInterest = accrual.totalAccrued + totalInterest;
      }
      break;
    }
    default:
      break;
  }

  return {
    planType: plan.planType,
    planLabel: paymentPlanLabels[plan.planType],
    monthlyPaymentNow: monthlyNow,
    emiAfterPossession: emiAfter,
    totalInterestEstimate: totalInterest,
    lumpSumAtPossession: lumpSum,
  };
}
