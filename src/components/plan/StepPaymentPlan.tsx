import * as React from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Equal,
  Handshake,
  Info,
  Pause,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyInput } from "./CurrencyInput";
import { cn } from "@/lib/utils";
import {
  type PaymentPlanInputs,
  type PaymentPlanType,
  paymentPlanLabels,
  generateDefaultTranches,
  computePreEmiSchedule,
  computeFullEmiComparison,
  computeAccumulatedDiff,
  computeEmiHoliday,
  formatMonthLabel,
} from "@/lib/payment-plan";
import { calcEMI, formatINR, type Home } from "@/lib/plan-schema";

interface Props {
  value: PaymentPlanInputs;
  onChange: (next: PaymentPlanInputs) => void;
  home: Home;
}

const PLAN_CARDS: Array<{
  type: PaymentPlanType;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  description: string;
}> = [
  {
    type: "pre_emi",
    icon: <BarChart3 className="h-6 w-6" />,
    badge: "Most common",
    description:
      "You pay only the interest on the amount disbursed so far. Interest increases as each tranche is released. Full EMI starts only after possession.",
  },
  {
    type: "full_emi_day1",
    icon: <CalendarDays className="h-6 w-6" />,
    description:
      "You pay the full EMI on the total sanctioned loan from Month 1 — even before full disbursement. This reduces your principal faster and saves interest overall.",
  },
  {
    type: "subvention",
    icon: <Handshake className="h-6 w-6" />,
    badge: "⚠️ Read carefully",
    badgeColor: "warning",
    description:
      "Your builder pays the EMI to the bank until possession. You pay nothing during construction. Full EMI is yours after possession.",
  },
  {
    type: "fixed_emi_accumulated",
    icon: <Equal className="h-6 w-6" />,
    description:
      "You pay a fixed EMI throughout construction. The gap between your fixed payment and actual interest due accumulates — payable as a lump sum or added to your loan at possession.",
  },
  {
    type: "emi_holiday",
    icon: <Pause className="h-6 w-6" />,
    badge: "⚠️ Hidden cost",
    badgeColor: "warning",
    description:
      "You pay nothing for a set period. Interest keeps accruing silently and is added to your principal when the holiday ends.",
  },
];

function isImmediatePossession(possessionMonth: number): boolean {
  return possessionMonth <= 3;
}

export function StepPaymentPlan({ value, onChange, home }: Props) {
  const immediate = isImmediatePossession(home.possessionMonth);
  const [showSkipHint, setShowSkipHint] = React.useState(false);

  // Auto-default timer: if no plan selected after 3 seconds of being on page
  const autoDefaultTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) =>
    onChange({ ...value, [k]: v });

  const selectPlan = (type: PaymentPlanType) => {
    if (autoDefaultTimer.current) clearTimeout(autoDefaultTimer.current);
    setShowSkipHint(false);
    const loanAmt = Math.max(0, home.propertyCost - home.downPayment);
    const needsTranches = type === "pre_emi" || type === "full_emi_day1" || type === "fixed_emi_accumulated";
    const tranches =
      needsTranches && (value.tranches.length === 0 || value.planType !== type)
        ? generateDefaultTranches(value.trancheCount || 3, loanAmt, home.possessionMonth)
        : value.tranches;
    onChange({
      ...value,
      planType: type,
      tranches,
      loanAmount: loanAmt,
      interestRate: home.interestRateA || value.interestRate,
      tenureYears: home.tenureYears || value.tenureYears,
      possessionMonth: home.possessionMonth,
    });
  };

  // Sync loan data from home when it changes
  React.useEffect(() => {
    const loanAmt = Math.max(0, home.propertyCost - home.downPayment);
    if (loanAmt !== value.loanAmount || home.possessionMonth !== value.possessionMonth) {
      onChange({
        ...value,
        loanAmount: loanAmt,
        interestRate: home.interestRateA || value.interestRate,
        tenureYears: home.tenureYears || value.tenureYears,
        possessionMonth: home.possessionMonth,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.propertyCost, home.downPayment, home.possessionMonth, home.interestRateA, home.tenureYears]);

  // Track if user hasn't selected — show hint after delay
  const handleNextAttempt = React.useCallback(() => {
    if (!value.planType) {
      setShowSkipHint(true);
      autoDefaultTimer.current = setTimeout(() => {
        selectPlan("pre_emi");
      }, 3000);
    }
  }, [value.planType]);

  // Expose for parent to call
  React.useEffect(() => {
    (window as any).__ppStepValidate = handleNextAttempt;
    return () => { delete (window as any).__ppStepValidate; };
  }, [handleNextAttempt]);

  const updateTranche = (id: string, patch: Partial<{ month: number; amount: number }>) => {
    set(
      "tranches",
      value.tranches.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const changeTrancheCount = (count: number) => {
    const loanAmt = value.loanAmount || Math.max(0, home.propertyCost - home.downPayment);
    onChange({
      ...value,
      trancheCount: count,
      tranches: generateDefaultTranches(count, loanAmt, home.possessionMonth),
    });
  };

  const fullEmi = calcEMI(value.loanAmount, value.interestRate, value.tenureYears);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Your Payment Plan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          How will you pay during construction? Your plan affects your monthly
          cash flow and total interest significantly.
        </p>
      </header>

      {/* Ready-to-move skip */}
      {immediate && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm text-foreground">
            Since your possession is immediate, this step does not apply. Your
            standard EMI will begin from your loan start date.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            You can still select a plan if your property has a construction
            phase, or skip to continue.
          </p>
        </div>
      )}

      {/* Plan cards */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PLAN_CARDS.map((card) => {
            const selected = value.planType === card.type;
            return (
              <button
                key={card.type}
                type="button"
                onClick={() => selectPlan(card.type)}
                className={cn(
                  "relative flex flex-col items-start gap-3 rounded-xl border-2 bg-card p-4 text-left shadow-soft transition-all hover:border-primary/50",
                  selected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border",
                )}
              >
                {selected && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-primary">{card.icon}</span>
                  {card.badge && (
                    <Badge
                      className={cn(
                        "text-xs",
                        card.badgeColor === "warning"
                          ? "border-warning bg-warning-soft text-warning-soft-foreground"
                          : "",
                      )}
                    >
                      {card.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {paymentPlanLabels[card.type]}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {card.description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          More plan types including Step-Up, Step-Down, and Custom are available
          if your plan is not listed here.
        </p>
        {showSkipHint && (
          <p className="text-sm font-medium text-destructive">
            Please select your payment plan to continue.
          </p>
        )}
      </section>

      {/* Plan-specific inputs */}
      {value.planType === "pre_emi" && (
        <PreEmiInputs
          value={value}
          onChange={onChange}
          fullEmi={fullEmi}
          onTrancheCountChange={changeTrancheCount}
          onTrancheUpdate={updateTranche}
          set={set}
        />
      )}
      {value.planType === "full_emi_day1" && (
        <FullEmiInputs
          value={value}
          onChange={onChange}
          fullEmi={fullEmi}
          onTrancheCountChange={changeTrancheCount}
          onTrancheUpdate={updateTranche}
          set={set}
        />
      )}
      {value.planType === "subvention" && (
        <SubventionInputs value={value} set={set} fullEmi={fullEmi} />
      )}
      {value.planType === "fixed_emi_accumulated" && (
        <FixedEmiInputs
          value={value}
          onChange={onChange}
          fullEmi={fullEmi}
          onTrancheCountChange={changeTrancheCount}
          onTrancheUpdate={updateTranche}
          set={set}
        />
      )}
      {value.planType === "emi_holiday" && (
        <EmiHolidayInputs value={value} set={set} />
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        HomeAfford is a scenario planning tool. All projections are illustrative
        and not financial, investment, or loan advice.
      </p>
    </div>
  );
}

// ────────────── Shared tranche UI ──────────────
function TrancheInputs({
  value,
  onTrancheCountChange,
  onTrancheUpdate,
  set,
}: {
  value: PaymentPlanInputs;
  onTrancheCountChange: (n: number) => void;
  onTrancheUpdate: (id: string, patch: Partial<{ month: number; amount: number }>) => void;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  const totalTranches = value.tranches.reduce((s, t) => s + t.amount, 0);
  const diff = value.loanAmount - totalTranches;

  return (
    <div className="space-y-4">
      {/* Tranche count */}
      <div className="space-y-1.5">
        <Label>Number of disbursement tranches</Label>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onTrancheCountChange(n)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors",
                value.trancheCount === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Tranche rows */}
      <div className="space-y-3">
        {value.tranches.map((t, i) => (
          <div
            key={t.id}
            className="rounded-xl border border-border bg-card p-3 shadow-soft"
          >
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              {t.label}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Disbursement month</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={t.month}
                  onChange={(e) =>
                    onTrancheUpdate(t.id, {
                      month: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  {formatMonthLabel(t.month)}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹)</Label>
                <CurrencyInput
                  value={t.amount}
                  onValueChange={(n) => onTrancheUpdate(t.id, { amount: n })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {Math.abs(diff) > 1 && (
        <p className="text-xs font-medium text-destructive">
          Tranches {diff > 0 ? "are short by" : "exceed loan by"}{" "}
          {formatINR(Math.abs(diff))} — total must equal{" "}
          {formatINR(value.loanAmount)}
        </p>
      )}

      {/* Interest rate */}
      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Annual interest rate (%)</Label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={50}
          value={value.interestRate || ""}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            set("interestRate", Number.isFinite(n) ? n : 0);
          }}
          placeholder="8.5"
          className="h-9"
        />
      </div>
    </div>
  );
}

// ────────────── Plan 1 ──────────────
function PreEmiInputs({
  value,
  onChange,
  fullEmi,
  onTrancheCountChange,
  onTrancheUpdate,
  set,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
  onTrancheCountChange: (n: number) => void;
  onTrancheUpdate: (id: string, patch: Partial<{ month: number; amount: number }>) => void;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  const { rows, totalPreEmi } = computePreEmiSchedule(
    value.tranches,
    value.interestRate,
    value.possessionMonth,
  );

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Pre-EMI Plan Details
      </h2>
      <TrancheInputs
        value={value}
        onTrancheCountChange={onTrancheCountChange}
        onTrancheUpdate={onTrancheUpdate}
        set={set}
      />

      {rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Your pre-EMI payment schedule
          </h3>
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4">Month</th>
                  <th className="py-2 px-4">Disbursed so far</th>
                  <th className="py-2 px-4">Pre-EMI this month</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-b border-border/60">
                    <td className="py-2 px-4 text-muted-foreground">{r.month}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.disbursedSoFar)}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.preEmi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              Total pre-EMI paid during construction:{" "}
              <span className="font-semibold">{formatINR(totalPreEmi)}</span>
            </p>
            <p>
              Full EMI after possession:{" "}
              <span className="font-semibold">{formatINR(fullEmi)}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ────────────── Plan 2 ──────────────
function FullEmiInputs({
  value,
  onChange,
  fullEmi,
  onTrancheCountChange,
  onTrancheUpdate,
  set,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
  onTrancheCountChange: (n: number) => void;
  onTrancheUpdate: (id: string, patch: Partial<{ month: number; amount: number }>) => void;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  const comparison = computeFullEmiComparison(
    value.tranches,
    value.loanAmount,
    value.interestRate,
    value.tenureYears,
    value.possessionMonth,
  );

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Full EMI From Day 1 — Details
      </h2>
      <TrancheInputs
        value={value}
        onTrancheCountChange={onTrancheCountChange}
        onTrancheUpdate={onTrancheUpdate}
        set={set}
      />

      <div className="rounded-xl bg-primary/10 px-4 py-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
          You pay from Month 1
        </p>
        <p className="mt-0.5 text-xl font-bold text-primary">
          {formatINR(comparison.fullEmi)}
        </p>
      </div>

      {/* Comparison grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Pre-EMI plan
          </p>
          <p>Monthly now: <span className="font-semibold">{formatINR(comparison.preEmiNow)}</span></p>
          <p>At possession: <span className="font-semibold">{formatINR(comparison.preEmiAtPossession)}</span></p>
          <p>Principal at possession: <span className="font-semibold">{formatINR(comparison.principalAtPossessionPreEmi)}</span></p>
          <p>Total interest: <span className="font-semibold">{formatINR(comparison.totalInterestPreEmi)}</span></p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase">
            This plan (Full EMI Day 1)
          </p>
          <p>Monthly now: <span className="font-semibold">{formatINR(comparison.fullEmi)}</span></p>
          <p>At possession: <span className="font-semibold">{formatINR(comparison.fullEmi)}</span></p>
          <p>Principal at possession: <span className="font-semibold">{formatINR(comparison.principalAtPossessionFullEmi)}</span></p>
          <p>Total interest: <span className="font-semibold">{formatINR(comparison.totalInterestFullEmi)}</span></p>
        </div>
      </div>

      {comparison.interestSaved > 0 && (
        <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
          Full EMI from Day 1 saves you{" "}
          <span className="font-bold">{formatINR(comparison.interestSaved)}</span>{" "}
          in total interest compared to Pre-EMI plan.
        </div>
      )}
    </section>
  );
}

// ────────────── Plan 3 ──────────────
function SubventionInputs({
  value,
  set,
  fullEmi,
}: {
  value: PaymentPlanInputs;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
  fullEmi: number;
}) {
  const constructionMonths = value.possessionMonth;

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Subvention Scheme — Details
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Booking amount you have paid (₹)</Label>
          <CurrencyInput
            value={value.bookingAmount}
            onValueChange={(n) => set("bookingAmount", n)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Month builder starts paying EMI</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={value.builderEmiStartMonth}
            onChange={(e) =>
              set("builderEmiStartMonth", Math.max(1, parseInt(e.target.value) || 1))
            }
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Possession month</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={value.possessionMonth}
            disabled
            className="h-9 opacity-60"
          />
          <p className="text-xs text-muted-foreground">Pre-filled from Your Home step</p>
        </div>
        <div className="space-y-1.5">
          <Label>Monthly EMI builder pays (₹)</Label>
          <CurrencyInput
            value={value.builderEmiAmount}
            onValueChange={(n) => set("builderEmiAmount", n)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-border p-4 text-sm space-y-2">
        <p className="font-semibold">
          During construction ({constructionMonths} months):
        </p>
        <p>You pay: <span className="font-bold text-primary">₹0/month</span></p>
        <p>Builder pays: <span className="font-semibold">{formatINR(value.builderEmiAmount)}/month</span> to bank</p>
        <p className="mt-2 font-semibold">After possession:</p>
        <p>You pay: <span className="font-bold">{formatINR(fullEmi)}/month</span></p>
      </div>

      {/* Warning */}
      <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">About the Subvention Scheme:</p>
          <p className="mt-1">
            If your builder misses even one EMI payment to the bank, it may
            affect your credit record — not the builder&apos;s. Before choosing
            this plan, verify your builder&apos;s payment history and ensure this
            is documented in your agreement.
          </p>
        </div>
      </div>
    </section>
  );
}

// ────────────── Plan 4 ──────────────
function FixedEmiInputs({
  value,
  onChange,
  fullEmi,
  onTrancheCountChange,
  onTrancheUpdate,
  set,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
  onTrancheCountChange: (n: number) => void;
  onTrancheUpdate: (id: string, patch: Partial<{ month: number; amount: number }>) => void;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  const { rows, totalAccumulated } = computeAccumulatedDiff(
    value.tranches,
    value.fixedEmiAmount,
    value.interestRate,
    value.possessionMonth,
  );

  const revisedLoan = value.loanAmount + totalAccumulated;
  const revisedEmi = calcEMI(revisedLoan, value.interestRate, value.tenureYears);

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Fixed EMI with Accumulated Difference — Details
      </h2>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Fixed EMI you pay each month (₹)</Label>
        <CurrencyInput
          value={value.fixedEmiAmount}
          onValueChange={(n) => set("fixedEmiAmount", n)}
          placeholder="0"
        />
      </div>

      <TrancheInputs
        value={value}
        onTrancheCountChange={onTrancheCountChange}
        onTrancheUpdate={onTrancheUpdate}
        set={set}
      />

      {rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            How your accumulated difference builds up:
          </h3>
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4">Month</th>
                  <th className="py-2 px-4">Interest due</th>
                  <th className="py-2 px-4">You pay</th>
                  <th className="py-2 px-4">Accumulated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-b border-border/60">
                    <td className="py-2 px-4 text-muted-foreground">{r.month}</td>
                    <td className="py-2 px-4">{formatINR(r.interestDue)}</td>
                    <td className="py-2 px-4">{formatINR(r.youPay)}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.accumulated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            Total accumulated by possession:{" "}
            <span className="font-bold">{formatINR(totalAccumulated)}</span>
          </p>
        </div>
      )}

      {/* Action choice */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">
          At possession, what do you prefer?
        </Label>
        <RadioGroup
          value={value.accumulatedDiffAction}
          onValueChange={(v) =>
            set("accumulatedDiffAction", v as "lump_sum" | "add_to_principal")
          }
          className="space-y-3"
        >
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <RadioGroupItem value="lump_sum" id="lump_sum" className="mt-0.5" />
            <label htmlFor="lump_sum" className="text-sm cursor-pointer">
              <span className="font-semibold">Pay as lump sum at possession</span>
              <br />
              <span className="text-muted-foreground">
                Lump sum due: {formatINR(totalAccumulated)} · EMI after possession:{" "}
                {formatINR(fullEmi)}
              </span>
            </label>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <RadioGroupItem value="add_to_principal" id="add_to_principal" className="mt-0.5" />
            <label htmlFor="add_to_principal" className="text-sm cursor-pointer">
              <span className="font-semibold">Add to principal</span>
              <br />
              <span className="text-muted-foreground">
                Revised loan: {formatINR(revisedLoan)} · Revised EMI:{" "}
                {formatINR(revisedEmi)}
              </span>
            </label>
          </div>
        </RadioGroup>
      </div>
    </section>
  );
}

// ────────────── Plan 5 ──────────────
function EmiHolidayInputs({
  value,
  set,
}: {
  value: PaymentPlanInputs;
  set: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  const [customHoliday, setCustomHoliday] = React.useState(false);
  const result = computeEmiHoliday(
    value.loanAmount,
    value.interestRate,
    value.holidayMonths,
    value.tenureYears,
  );

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        EMI Holiday / Moratorium — Details
      </h2>

      <div className="space-y-1.5">
        <Label>Holiday duration</Label>
        <div className="flex flex-wrap gap-2">
          {[6, 12, 18].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                set("holidayMonths", m);
                setCustomHoliday(false);
              }}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
                !customHoliday && value.holidayMonths === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {m} months
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomHoliday(true)}
            className={cn(
              "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
              customHoliday
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50",
            )}
          >
            Custom
          </button>
        </div>
        {customHoliday && (
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={value.holidayMonths}
            onChange={(e) =>
              set("holidayMonths", Math.max(1, parseInt(e.target.value) || 1))
            }
            className="mt-2 h-9 max-w-[8rem]"
            placeholder="Months"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Annual interest rate (%)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={50}
            value={value.interestRate || ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              set("interestRate", Number.isFinite(n) ? n : 0);
            }}
            placeholder="8.5"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Loan amount (₹)</Label>
          <CurrencyInput
            value={value.loanAmount}
            onValueChange={(n) => set("loanAmount", n)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          During your {value.holidayMonths}-month holiday:
        </h3>
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="py-2 px-4">Month</th>
                <th className="py-2 px-4">Interest accruing</th>
                <th className="py-2 px-4">Running total added</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.month} className="border-b border-border/60">
                  <td className="py-2 px-4 text-muted-foreground">{r.month}</td>
                  <td className="py-2 px-4">{formatINR(r.interestAccruing)}</td>
                  <td className="py-2 px-4 font-medium">{formatINR(r.runningTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning callout */}
      <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p>
            A {value.holidayMonths}-month EMI holiday silently adds{" "}
            <span className="font-bold">{formatINR(result.totalAccrued)}</span>{" "}
            to your loan. Your EMI after the holiday will be{" "}
            <span className="font-bold">{formatINR(result.revisedEmi)}</span> —{" "}
            <span className="font-bold">
              {formatINR(result.revisedEmi - result.originalEmi)}
            </span>{" "}
            more than originally planned — for the entire remaining tenure.
          </p>
          <p className="mt-2">
            Your revised principal after holiday:{" "}
            <span className="font-bold">{formatINR(result.revisedPrincipal)}</span>
          </p>
          <p>
            Your revised EMI after holiday:{" "}
            <span className="font-bold">{formatINR(result.revisedEmi)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
