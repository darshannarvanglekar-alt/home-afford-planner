// Loan Relief Planner — pure calculations.
// Supports multiple part payments at any point in the loan lifecycle.
import { calcEMI } from "@/lib/plan-schema";

export type PrepayMode = "reduce_emi" | "shorten_tenure";

export interface PartPayment {
  id: string;
  label: string;
  amount: number;
  timing: "before_possession" | "after_possession";
  month: number; // 1-based month relative to timing context
  mode: PrepayMode;
}

// Legacy interface kept for compatibility
export interface LoanReliefInputs {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
  emiOverride?: number;
  startYear: number;
  startMonth: number; // 1-12
  // One-time (legacy)
  oneTimeAmount: number;
  oneTimeAtMonth: number;
  oneTimeMode: PrepayMode;
  // Recurring extra
  extraMonthly: number;
  extraStartMonth: number;
  stepUpEnabled: boolean;
  stepUpPct: number;
  useOneTime: boolean;
  useRecurring: boolean;
}

export interface MultiPaymentInputs {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
  emiOverride?: number;
  startYear: number;
  startMonth: number;
  possessionMonth?: number; // month offset from loan start when possession happens
  partPayments: PartPayment[];
  // Recurring extra (kept)
  extraMonthly: number;
  extraStartMonth: number;
  stepUpEnabled: boolean;
  stepUpPct: number;
  useRecurring: boolean;
}

export interface AmortPoint {
  month: number;
  balance: number;
  interestPaid: number;
  principalPaid: number;
  emi: number;
}

export interface AmortResult {
  points: AmortPoint[];
  totalInterest: number;
  totalPaid: number;
  monthsToClose: number;
  emi: number;
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

export function monthLabelFromOffset(startYear: number, startMonth: number, offset: number): string {
  const d = addMonths(startYear, startMonth, offset - 1);
  return monthLabel(d.year, d.month);
}

interface AmortizeOpts {
  principal: number;
  annualRatePct: number;
  emi: number;
  maxMonths: number;
  // Map of month -> array of { amount, mode }
  partPaymentsByMonth?: Map<number, Array<{ amount: number; mode: PrepayMode }>>;
  recurring?: { amount: number; startMonth: number; stepUpPct: number } | null;
  startYear: number;
  startMonth: number;
}

function amortize(opts: AmortizeOpts): AmortResult {
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

    // Part payments at this month
    const pps = opts.partPaymentsByMonth?.get(m);
    if (pps) {
      for (const pp of pps) {
        if (balance <= 0.5) break;
        const lump = Math.min(pp.amount, balance);
        balance -= lump;
        payment += lump;
        if (pp.mode === "reduce_emi" && balance > 0.5) {
          const remainingMonths = Math.max(1, opts.maxMonths - m);
          emi = calcEMI(balance, opts.annualRatePct, remainingMonths / 12);
        }
      }
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

/** Resolve part payments to absolute month offsets from loan start */
export function resolvePartPayments(
  payments: PartPayment[],
  possessionMonth: number,
): Array<{ month: number; amount: number; mode: PrepayMode; label: string; id: string }> {
  return payments
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: p.id,
      label: p.label || "Part payment",
      amount: p.amount,
      mode: p.mode,
      month:
        p.timing === "before_possession"
          ? Math.max(1, p.month)
          : Math.max(1, (possessionMonth || 1) + p.month),
    }));
}

export function computeMultiPaymentRelief(inputs: MultiPaymentInputs) {
  const baseEmi =
    inputs.emiOverride && inputs.emiOverride > 0
      ? inputs.emiOverride
      : calcEMI(inputs.principal, inputs.annualRatePct, inputs.tenureYears);

  const totalMonths = Math.max(1, Math.round(inputs.tenureYears * 12));
  const maxMonths = Math.max(totalMonths, 12 * 50);

  const baseline = amortize({
    principal: inputs.principal,
    annualRatePct: inputs.annualRatePct,
    emi: baseEmi,
    maxMonths,
    startYear: inputs.startYear,
    startMonth: inputs.startMonth,
  });

  const possessionMonth = inputs.possessionMonth || 1;
  const resolved = resolvePartPayments(inputs.partPayments, possessionMonth);

  // Build part payments map
  const ppMap = new Map<number, Array<{ amount: number; mode: PrepayMode }>>();
  for (const rp of resolved) {
    const existing = ppMap.get(rp.month) || [];
    existing.push({ amount: rp.amount, mode: rp.mode });
    ppMap.set(rp.month, existing);
  }

  const recurring =
    inputs.useRecurring && inputs.extraMonthly > 0
      ? {
          amount: inputs.extraMonthly,
          startMonth: Math.max(1, Math.min(inputs.extraStartMonth, totalMonths)),
          stepUpPct: inputs.stepUpEnabled ? inputs.stepUpPct : 0,
        }
      : null;

  const withPayments = amortize({
    principal: inputs.principal,
    annualRatePct: inputs.annualRatePct,
    emi: baseEmi,
    maxMonths,
    partPaymentsByMonth: ppMap,
    recurring,
    startYear: inputs.startYear,
    startMonth: inputs.startMonth,
  });

  const interestSaved = Math.max(0, baseline.totalInterest - withPayments.totalInterest);
  const monthsSaved = Math.max(0, baseline.monthsToClose - withPayments.monthsToClose);

  // Per-payment impact breakdown: compute each payment in isolation
  const perPaymentImpact = resolved.map((rp) => {
    const singleMap = new Map<number, Array<{ amount: number; mode: PrepayMode }>>();
    singleMap.set(rp.month, [{ amount: rp.amount, mode: rp.mode }]);
    const singleResult = amortize({
      principal: inputs.principal,
      annualRatePct: inputs.annualRatePct,
      emi: baseEmi,
      maxMonths,
      partPaymentsByMonth: singleMap,
      startYear: inputs.startYear,
      startMonth: inputs.startMonth,
    });
    return {
      id: rp.id,
      label: rp.label,
      month: rp.month,
      amount: rp.amount,
      interestSaved: Math.max(0, baseline.totalInterest - singleResult.totalInterest),
      monthsSaved: Math.max(0, baseline.monthsToClose - singleResult.monthsToClose),
    };
  });

  // Check if any payment uses reduce_emi mode — if so build that path too
  const hasReduceEmi = resolved.some((rp) => rp.mode === "reduce_emi");

  return {
    baseEmi,
    baseline,
    withPayments,
    interestSaved,
    monthsSaved,
    perPaymentImpact,
    hasReduceEmi,
    resolved,
    possessionMonth,
  };
}

// Legacy API preserved for backward compatibility
export function computeRelief(inputs: LoanReliefInputs) {
  const baseEmi =
    inputs.emiOverride && inputs.emiOverride > 0
      ? inputs.emiOverride
      : calcEMI(inputs.principal, inputs.annualRatePct, inputs.tenureYears);

  const totalMonths = Math.max(1, Math.round(inputs.tenureYears * 12));
  const maxMonths = Math.max(totalMonths, 12 * 50);

  const baseline = amortize({
    principal: inputs.principal,
    annualRatePct: inputs.annualRatePct,
    emi: baseEmi,
    maxMonths,
    startYear: inputs.startYear,
    startMonth: inputs.startMonth,
  });

  const ppMap = new Map<number, Array<{ amount: number; mode: PrepayMode }>>();
  if (inputs.useOneTime && inputs.oneTimeAmount > 0) {
    const atMonth = Math.max(1, Math.min(inputs.oneTimeAtMonth, totalMonths));
    ppMap.set(atMonth, [{ amount: inputs.oneTimeAmount, mode: inputs.oneTimeMode }]);
  }

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
    partPaymentsByMonth: ppMap,
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

export function buildMultiChartData(
  baseline: AmortResult,
  withPayments: AmortResult,
  resolved: Array<{ month: number; label: string; amount: number }>,
  possessionMonth: number,
) {
  const len = Math.max(baseline.points.length, withPayments.points.length);
  const data: Array<{
    month: number;
    without: number | null;
    withPayments: number | null;
    isPossession?: boolean;
    paymentEvent?: { label: string; amount: number };
  }> = [];
  const paymentMonths = new Map(resolved.map((r) => [r.month, r]));
  for (let i = 0; i < len; i += 1) {
    const m = i + 1;
    const entry: (typeof data)[0] = {
      month: m,
      without: baseline.points[i]?.balance ?? null,
      withPayments: withPayments.points[i]?.balance ?? (i < withPayments.monthsToClose ? null : 0),
    };
    if (m === possessionMonth) entry.isPossession = true;
    const pe = paymentMonths.get(m);
    if (pe) entry.paymentEvent = { label: pe.label, amount: pe.amount };
    data.push(entry);
  }
  return data;
}

export function generatePartPaymentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
