// Loan Relief Planner — pure calculations.
// Builds month-by-month amortization with optional one-time prepayment
// and/or recurring extra monthly payments (with annual step-up).
import { calcEMI } from "@/lib/plan-schema";

export type PrepayMode = "reduce_emi" | "shorten_tenure";

export interface LoanReliefInputs {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
  emiOverride?: number; // if user manually edits EMI
  startYear: number;
  startMonth: number; // 1-12
  // One-time
  oneTimeAmount: number;
  oneTimeAtMonth: number; // 1-based month index from start
  oneTimeMode: PrepayMode;
  // Recurring extra
  extraMonthly: number;
  extraStartMonth: number; // 1-based
  stepUpEnabled: boolean;
  stepUpPct: number; // e.g. 10
  // Toggle which scenarios are active
  useOneTime: boolean;
  useRecurring: boolean;
}

export interface AmortPoint {
  month: number; // 1-based month from start
  balance: number;
  interestPaid: number;
  principalPaid: number;
  emi: number;
}

export interface AmortResult {
  points: AmortPoint[];
  totalInterest: number;
  totalPaid: number;
  monthsToClose: number; // months until balance hits 0
  emi: number; // base EMI used
  closureDate: { year: number; month: number };
}

function addMonths(year: number, month: number, add: number): { year: number; month: number } {
  const m0 = (month - 1) + add;
  const y = year + Math.floor(m0 / 12);
  const m = (m0 % 12 + 12) % 12;
  return { year: y, month: m + 1 };
}

export function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function amortize(opts: {
  principal: number;
  annualRatePct: number;
  emi: number;
  maxMonths: number;
  oneTime?: { amount: number; atMonth: number; mode: PrepayMode } | null;
  recurring?: { amount: number; startMonth: number; stepUpPct: number } | null;
  startYear: number;
  startMonth: number;
}): AmortResult {
  const r = opts.annualRatePct / 12 / 100;
  let balance = Math.max(0, opts.principal);
  let emi = opts.emi;
  let totalInterest = 0;
  let totalPaid = 0;
  const points: AmortPoint[] = [];
  let extraThisYear = opts.recurring?.amount ?? 0;
  let monthsToClose = 0;

  for (let m = 1; m <= opts.maxMonths; m += 1) {
    if (balance <= 0.5) break;
    // Annual step-up applied at the start of each new "year of extra payments"
    if (
      opts.recurring &&
      opts.recurring.stepUpPct > 0 &&
      m > opts.recurring.startMonth &&
      (m - opts.recurring.startMonth) % 12 === 0
    ) {
      extraThisYear = extraThisYear * (1 + opts.recurring.stepUpPct / 100);
    }

    const interest = balance * r;
    let principalPart = Math.min(emi - interest, balance);
    if (principalPart < 0) principalPart = 0;
    let payment = interest + principalPart;
    balance -= principalPart;

    // Recurring extra payment
    if (opts.recurring && m >= opts.recurring.startMonth && balance > 0) {
      const extra = Math.min(extraThisYear, balance);
      balance -= extra;
      payment += extra;
    }

    // One-time prepayment
    if (opts.oneTime && m === opts.oneTime.atMonth && balance > 0) {
      const lump = Math.min(opts.oneTime.amount, balance);
      balance -= lump;
      payment += lump;
      // Recompute EMI if user wants to reduce EMI (keep remaining tenure)
      if (opts.oneTime.mode === "reduce_emi") {
        const remainingMonths = Math.max(1, opts.maxMonths - m);
        emi = calcEMI(balance, opts.annualRatePct, remainingMonths / 12);
      }
      // shorten_tenure: keep EMI as-is
    }

    totalInterest += interest;
    totalPaid += payment;
    points.push({
      month: m,
      balance: Math.max(0, balance),
      interestPaid: totalInterest,
      principalPaid: opts.principal - balance,
      emi,
    });
    monthsToClose = m;
    if (balance <= 0.5) break;
  }

  const closureDate = addMonths(opts.startYear, opts.startMonth, monthsToClose - 1);
  return { points, totalInterest, totalPaid, monthsToClose, emi: opts.emi, closureDate };
}

export function computeRelief(inputs: LoanReliefInputs) {
  const baseEmi =
    inputs.emiOverride && inputs.emiOverride > 0
      ? inputs.emiOverride
      : calcEMI(inputs.principal, inputs.annualRatePct, inputs.tenureYears);

  const totalMonths = Math.max(1, Math.round(inputs.tenureYears * 12));
  // Allow some headroom in case of override producing very low EMI
  const maxMonths = Math.max(totalMonths, 12 * 50);

  const baseline = amortize({
    principal: inputs.principal,
    annualRatePct: inputs.annualRatePct,
    emi: baseEmi,
    maxMonths,
    startYear: inputs.startYear,
    startMonth: inputs.startMonth,
  });

  const oneTime =
    inputs.useOneTime && inputs.oneTimeAmount > 0
      ? {
          amount: inputs.oneTimeAmount,
          atMonth: Math.max(1, Math.min(inputs.oneTimeAtMonth, totalMonths)),
          mode: inputs.oneTimeMode,
        }
      : null;
  const recurring =
    inputs.useRecurring && inputs.extraMonthly > 0
      ? {
          amount: inputs.extraMonthly,
          startMonth: Math.max(1, Math.min(inputs.extraStartMonth, totalMonths)),
          stepUpPct: inputs.stepUpEnabled ? inputs.stepUpPct : 0,
        }
      : null;

  const withPrepay = amortize({
    principal: inputs.principal,
    annualRatePct: inputs.annualRatePct,
    emi: baseEmi,
    maxMonths,
    oneTime,
    recurring,
    startYear: inputs.startYear,
    startMonth: inputs.startMonth,
  });

  const interestSaved = Math.max(0, baseline.totalInterest - withPrepay.totalInterest);
  const monthsSaved = Math.max(0, baseline.monthsToClose - withPrepay.monthsToClose);

  return { baseEmi, baseline, withPrepay, interestSaved, monthsSaved };
}

export function formatYearsMonths(months: number): string {
  if (months <= 0) return "0 months";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const yPart = y > 0 ? `${y} year${y > 1 ? "s" : ""}` : "";
  const mPart = m > 0 ? `${m} month${m > 1 ? "s" : ""}` : "";
  return [yPart, mPart].filter(Boolean).join(" ") || "0 months";
}

export function buildChartData(baseline: AmortResult, withPrepay: AmortResult) {
  const len = Math.max(baseline.points.length, withPrepay.points.length);
  const data: Array<{ month: number; without: number | null; with: number | null }> = [];
  for (let i = 0; i < len; i += 1) {
    data.push({
      month: i + 1,
      without: baseline.points[i]?.balance ?? null,
      with: withPrepay.points[i]?.balance ?? (i < withPrepay.monthsToClose ? null : 0),
    });
  }
  return data;
}
