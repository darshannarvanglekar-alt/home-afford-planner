import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Equal,
  Handshake,
  Info,
  Pause,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CurrencyInput } from "./CurrencyInput";
import { cn } from "@/lib/utils";
import {
  type PaymentPlanInputs,
  type PaymentPlanType,
  type StepUpConfig,
  type StepDownConfig,
  type CustomMilestone,
  type CustomChangePoint,
  paymentPlanLabels,
  generateDefaultTranches,
  computePreEmiSchedule,
  computeFullEmiComparison,
  computeAccumulatedDiff,
  computeEmiHoliday,
  computeStepUpSchedule,
  computeStepDownSchedule,
  computePossessionDateAccrual,
  computePlanComparison,
  formatMonthLabel,
  defaultStepUpConfig,
  defaultStepDownConfig,
  defaultPossessionStartConfig,
  defaultCustomPlanConfig,
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
  {
    type: "step_up_emi",
    icon: <ArrowUpRight className="h-6 w-6" />,
    description:
      "Start with a lower EMI that increases every year. Designed for buyers expecting income growth over time. Total interest is slightly higher than a standard EMI.",
  },
  {
    type: "step_down_emi",
    icon: <ArrowDownRight className="h-6 w-6" />,
    description:
      "Start with a higher EMI that reduces over time. Pays off principal faster in early years, saving significant total interest.",
  },
  {
    type: "possession_date_start",
    icon: <Clock className="h-6 w-6" />,
    badge: "⚠️ High hidden cost",
    badgeColor: "warning",
    description:
      "You pay nothing at all until possession. All interest accrues silently during construction and is either added to your principal or paid as a lump sum at possession.",
  },
  {
    type: "custom_plan",
    icon: <Pencil className="h-6 w-6" />,
    description:
      "Your plan doesn't fit any of the above. Define your own payment schedule for before possession, at possession, and after.",
  },
];

function isImmediatePossession(possessionMonth: number): boolean {
  return possessionMonth <= 3;
}

export function StepPaymentPlan({ value, onChange, home }: Props) {
  const immediate = isImmediatePossession(home.possessionMonth);
  const [showSkipHint, setShowSkipHint] = React.useState(false);

  const autoDefaultTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) =>
    onChange({ ...value, [k]: v });

  const selectPlan = (type: PaymentPlanType) => {
    if (autoDefaultTimer.current) clearTimeout(autoDefaultTimer.current);
    setShowSkipHint(false);
    const loanAmt = Math.max(0, home.propertyCost - home.downPayment);
    const needsTranches = type === "pre_emi" || type === "full_emi_day1" || type === "fixed_emi_accumulated";
    const stageCount = home.disbursementStages || 3;
    const tranches =
      needsTranches && (value.tranches.length === 0 || value.planType !== type)
        ? generateDefaultTranches(stageCount, loanAmt, home.possessionMonth)
        : value.tranches;
    const fullEmi = calcEMI(loanAmt, home.interestRateA, home.tenureYears);
    onChange({
      ...value,
      planType: type,
      tranches,
      trancheCount: stageCount,
      loanAmount: loanAmt,
      interestRate: home.interestRateA,
      tenureYears: home.tenureYears,
      possessionMonth: home.possessionMonth,
      // Auto-populate step-up/down starting EMI if not set
      stepUp: {
        ...value.stepUp,
        startingEmi: value.stepUp.startingEmi || Math.round(fullEmi * 0.7),
      },
      stepDown: {
        ...value.stepDown,
        startingEmi: value.stepDown.startingEmi || Math.round(fullEmi * 1.3),
      },
    });
  };

  React.useEffect(() => {
    const loanAmt = Math.max(0, home.propertyCost - home.downPayment);
    const stageCount = home.disbursementStages || 3;
    if (loanAmt !== value.loanAmount || home.possessionMonth !== value.possessionMonth || home.interestRateA !== value.interestRate || home.tenureYears !== value.tenureYears) {
      const needsTranches = value.planType === "pre_emi" || value.planType === "full_emi_day1" || value.planType === "fixed_emi_accumulated";
      onChange({
        ...value,
        loanAmount: loanAmt,
        interestRate: home.interestRateA,
        tenureYears: home.tenureYears,
        possessionMonth: home.possessionMonth,
        trancheCount: stageCount,
        tranches: needsTranches ? generateDefaultTranches(stageCount, loanAmt, home.possessionMonth) : value.tranches,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.propertyCost, home.downPayment, home.possessionMonth, home.interestRateA, home.tenureYears, home.disbursementStages]);

  const handleNextAttempt = React.useCallback(() => {
    if (!value.planType) {
      setShowSkipHint(true);
      autoDefaultTimer.current = setTimeout(() => {
        selectPlan("pre_emi");
      }, 3000);
    }
  }, [value.planType]);

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

  const showComparison = ["step_up_emi", "step_down_emi", "possession_date_start", "custom_plan"].includes(value.planType);

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
      {value.planType === "step_up_emi" && (
        <StepUpEmiInputs value={value} onChange={onChange} fullEmi={fullEmi} />
      )}
      {value.planType === "step_down_emi" && (
        <StepDownEmiInputs value={value} onChange={onChange} fullEmi={fullEmi} />
      )}
      {value.planType === "possession_date_start" && (
        <PossessionStartInputs value={value} onChange={onChange} fullEmi={fullEmi} />
      )}
      {value.planType === "custom_plan" && (
        <CustomPlanInputs value={value} onChange={onChange} fullEmi={fullEmi} />
      )}

      {/* Plan comparison */}
      {showComparison && <PlanComparisonSection value={value} />}

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
}: {
  value: PaymentPlanInputs;
  onTrancheCountChange?: (n: number) => void;
  onTrancheUpdate?: (id: string, patch: Partial<{ month: number; amount: number }>) => void;
  set?: <K extends keyof PaymentPlanInputs>(k: K, v: PaymentPlanInputs[K]) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Read-only interest rate display (Fix 1) */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm text-foreground">
          Using your loan interest rate:{" "}
          <span className="font-bold text-primary">{value.interestRate}%</span>{" "}
          <span className="text-xs text-muted-foreground">(edit in Your Loan step)</span>
        </p>
      </div>

      {/* Equal disbursement summary (Fix 4) */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">
          Disbursement: {value.trancheCount} equal stages
        </p>
        <p className="text-xs text-muted-foreground">
          {formatINR(Math.round(value.loanAmount / (value.trancheCount || 3)))} per stage,
          spread across {value.possessionMonth} months of construction.
        </p>
        <p className="text-xs text-muted-foreground">
          We assume equal disbursement across stages. This gives a close approximation for planning purposes.
        </p>
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
      <TrancheInputs value={value} />

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

      <div className="rounded-xl border border-border p-4 text-sm space-y-2">
        <p className="font-semibold">
          During construction ({constructionMonths} months):
        </p>
        <p>You pay: <span className="font-bold text-primary">₹0/month</span></p>
        <p>Builder pays: <span className="font-semibold">{formatINR(value.builderEmiAmount)}/month</span> to bank</p>
        <p className="mt-2 font-semibold">After possession:</p>
        <p>You pay: <span className="font-bold">{formatINR(fullEmi)}/month</span></p>
      </div>

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

// ────────────── Plan 6 — Step-Up EMI ──────────────
function StepUpEmiInputs({
  value,
  onChange,
  fullEmi,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
}) {
  const cfg = value.stepUp;
  const setCfg = (patch: Partial<StepUpConfig>) =>
    onChange({ ...value, stepUp: { ...cfg, ...patch } });

  const result = computeStepUpSchedule(cfg, value.loanAmount, value.interestRate, value.tenureYears);
  const extraCost = result.totalInterest - result.standardTotalInterest;

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Step-Up EMI — Details
      </h2>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Starting EMI amount (₹)</Label>
        <CurrencyInput
          value={cfg.startingEmi}
          onValueChange={(n) => setCfg({ startingEmi: n })}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          This should be lower than your standard calculated EMI of {formatINR(fullEmi)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Step-up type</Label>
        <div className="flex flex-wrap gap-2">
          {(["fixed", "percentage"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCfg({ stepType: t })}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
                cfg.stepType === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {t === "fixed" ? "Fixed increase (₹)" : "Percentage increase (%)"}
            </button>
          ))}
        </div>
        <div className="mt-2 sm:max-w-xs">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={cfg.stepAmount || ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setCfg({ stepAmount: Number.isFinite(n) ? n : 0 });
            }}
            placeholder={cfg.stepType === "fixed" ? "₹5,000" : "10%"}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Step-up frequency</Label>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setCfg({ stepFrequencyYears: y })}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
                cfg.stepFrequencyYears === y
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              Every {y} year{y > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Number of step-up periods before EMI stabilises: {cfg.stepPeriods}</Label>
        <Slider
          value={[cfg.stepPeriods]}
          min={1}
          max={10}
          step={1}
          onValueChange={([v]) => setCfg({ stepPeriods: v })}
          className="max-w-xs"
        />
      </div>

      {/* Schedule table */}
      {result.rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Your step-up EMI schedule:
          </h3>
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4">Period</th>
                  <th className="py-2 px-4">Years</th>
                  <th className="py-2 px-4">Monthly EMI</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.period} className="border-b border-border/60">
                    <td className="py-2 px-4 text-muted-foreground">Period {r.period}</td>
                    <td className="py-2 px-4">{r.yearLabel}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.monthlyEmi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Standard EMI</p>
          <p>{formatINR(fullEmi)}/month always</p>
          <p>Total interest: <span className="font-semibold">{formatINR(result.standardTotalInterest)}</span></p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase">Step-Up EMI</p>
          <p>Starts {formatINR(cfg.startingEmi)}/month</p>
          <p>Total interest: <span className="font-semibold">{formatINR(result.totalInterest)}</span></p>
          {extraCost > 0 && (
            <p className="font-semibold text-warning-soft-foreground">
              Extra cost: {formatINR(extraCost)}
            </p>
          )}
        </div>
      </div>

      {extraCost > 0 && (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            The lower starting EMI costs you {formatINR(extraCost)} extra in total interest over the loan tenure.
          </p>
        </div>
      )}
    </section>
  );
}

// ────────────── Plan 7 — Step-Down EMI ──────────────
function StepDownEmiInputs({
  value,
  onChange,
  fullEmi,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
}) {
  const cfg = value.stepDown;
  const setCfg = (patch: Partial<StepDownConfig>) =>
    onChange({ ...value, stepDown: { ...cfg, ...patch } });

  const result = computeStepDownSchedule(cfg, value.loanAmount, value.interestRate, value.tenureYears);
  const interestSaved = result.standardTotalInterest - result.totalInterest;

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Step-Down EMI — Details
      </h2>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Starting EMI amount (₹)</Label>
        <CurrencyInput
          value={cfg.startingEmi}
          onValueChange={(n) => setCfg({ startingEmi: n })}
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          This should be higher than your standard calculated EMI of {formatINR(fullEmi)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Step-down type</Label>
        <div className="flex flex-wrap gap-2">
          {(["fixed", "percentage"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCfg({ stepType: t })}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
                cfg.stepType === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {t === "fixed" ? "Fixed decrease (₹)" : "Percentage decrease (%)"}
            </button>
          ))}
        </div>
        <div className="mt-2 sm:max-w-xs">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={cfg.stepAmount || ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setCfg({ stepAmount: Number.isFinite(n) ? n : 0 });
            }}
            placeholder={cfg.stepType === "fixed" ? "₹5,000" : "10%"}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Step-down frequency</Label>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setCfg({ stepFrequencyYears: y })}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors",
                cfg.stepFrequencyYears === y
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              Every {y} year{y > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Number of step-down periods before EMI stabilises: {cfg.stepPeriods}</Label>
        <Slider
          value={[cfg.stepPeriods]}
          min={1}
          max={10}
          step={1}
          onValueChange={([v]) => setCfg({ stepPeriods: v })}
          className="max-w-xs"
        />
      </div>

      {result.rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Your step-down EMI schedule:
          </h3>
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4">Period</th>
                  <th className="py-2 px-4">Years</th>
                  <th className="py-2 px-4">Monthly EMI</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.period} className="border-b border-border/60">
                    <td className="py-2 px-4 text-muted-foreground">Period {r.period}</td>
                    <td className="py-2 px-4">{r.yearLabel}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.monthlyEmi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Standard EMI</p>
          <p>{formatINR(fullEmi)}/month always</p>
          <p>Total interest: <span className="font-semibold">{formatINR(result.standardTotalInterest)}</span></p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase">Step-Down EMI</p>
          <p>Starts {formatINR(cfg.startingEmi)}/month</p>
          <p>Total interest: <span className="font-semibold">{formatINR(result.totalInterest)}</span></p>
          {interestSaved > 0 && (
            <p className="font-semibold text-success-soft-foreground">
              Interest saved: {formatINR(interestSaved)}
            </p>
          )}
        </div>
      </div>

      {interestSaved > 0 && (
        <div className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
          The higher starting EMI saves you {formatINR(interestSaved)} in total interest over the loan tenure.
        </div>
      )}
    </section>
  );
}

// ────────────── Plan 8 — Possession-Date EMI Start ──────────────
function PossessionStartInputs({
  value,
  onChange,
  fullEmi,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
}) {
  const cfg = value.possessionStart;
  const setCfg = (patch: Partial<typeof cfg>) =>
    onChange({ ...value, possessionStart: { ...cfg, ...patch } });

  const { rows, totalAccrued } = computePossessionDateAccrual(
    value.loanAmount,
    value.interestRate,
    value.possessionMonth,
  );

  const revisedLoan = value.loanAmount + totalAccrued;
  const revisedEmi = calcEMI(revisedLoan, value.interestRate, value.tenureYears);

  const possDate = new Date();
  possDate.setMonth(possDate.getMonth() + value.possessionMonth - 1);
  const possLabel = possDate.toLocaleString("en-IN", { month: "short", year: "numeric" });

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Possession-Date EMI Start — Details
      </h2>

      <div className="rounded-xl border border-border p-4 text-sm space-y-1">
        <p className="font-semibold">
          Construction period: {value.possessionMonth} months
        </p>
        <p className="text-muted-foreground">
          (from today to {possLabel})
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Annual interest rate (%)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={value.interestRate || ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange({ ...value, interestRate: Number.isFinite(n) ? n : 0 });
            }}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Loan amount (₹)</Label>
          <CurrencyInput
            value={value.loanAmount}
            onValueChange={(n) => onChange({ ...value, loanAmount: n })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Accrual table */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Interest accruing silently during construction:
          </h3>
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4">Month</th>
                  <th className="py-2 px-4">Monthly interest</th>
                  <th className="py-2 px-4">Total accrued so far</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-b border-border/60">
                    <td className="py-2 px-4 text-muted-foreground">
                      {r.month === value.possessionMonth ? "Possession" : `Month ${r.month}`}
                    </td>
                    <td className="py-2 px-4">{formatINR(r.monthlyInterest)}</td>
                    <td className="py-2 px-4 font-medium">{formatINR(r.totalAccrued)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          By possession, {formatINR(totalAccrued)} in interest will have built up silently.
          This is the hidden cost of paying nothing during construction.
        </p>
      </div>

      {/* Action choice */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">
          At possession, what do you prefer?
        </Label>
        <RadioGroup
          value={cfg.accruedAction}
          onValueChange={(v) =>
            setCfg({ accruedAction: v as "add_to_principal" | "lump_sum" })
          }
          className="space-y-3"
        >
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <RadioGroupItem value="add_to_principal" id="p8_add" className="mt-0.5" />
            <label htmlFor="p8_add" className="text-sm cursor-pointer space-y-1">
              <span className="font-semibold">Add all accrued interest to my principal</span>
              <br />
              <span className="text-muted-foreground">
                Revised loan amount: {formatINR(revisedLoan)}
              </span>
              <br />
              <span className="text-muted-foreground">
                EMI after possession: {formatINR(revisedEmi)}
              </span>
              <br />
              <span className="text-xs text-warning-soft-foreground">
                You will pay interest on interest for the entire remaining tenure.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <RadioGroupItem value="lump_sum" id="p8_lump" className="mt-0.5" />
            <label htmlFor="p8_lump" className="text-sm cursor-pointer space-y-1">
              <span className="font-semibold">Pay all accrued interest as lump sum at possession</span>
              <br />
              <span className="text-muted-foreground">
                Lump sum due at possession: {formatINR(totalAccrued)}
              </span>
              <br />
              <span className="text-muted-foreground">
                EMI after possession: {formatINR(fullEmi)}
              </span>
              <br />
              <span className="text-xs text-muted-foreground">
                Ensure you have {formatINR(totalAccrued)} available at possession.
              </span>
            </label>
          </div>
        </RadioGroup>
      </div>
    </section>
  );
}

// ────────────── Plan 9 — Custom Plan ──────────────
function CustomPlanInputs({
  value,
  onChange,
  fullEmi,
}: {
  value: PaymentPlanInputs;
  onChange: (v: PaymentPlanInputs) => void;
  fullEmi: number;
}) {
  const cp = value.customPlan;
  const setCp = (patch: Partial<typeof cp>) =>
    onChange({ ...value, customPlan: { ...cp, ...patch } });

  const addMilestone = () => {
    if (cp.phaseAMilestones.length >= 6) return;
    setCp({
      phaseAMilestones: [
        ...cp.phaseAMilestones,
        { id: `ms_${Date.now()}`, fromMonth: 1, amount: 0 },
      ],
    });
  };

  const removeMilestone = (id: string) => {
    setCp({ phaseAMilestones: cp.phaseAMilestones.filter((m) => m.id !== id) });
  };

  const updateMilestone = (id: string, patch: Partial<CustomMilestone>) => {
    setCp({
      phaseAMilestones: cp.phaseAMilestones.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    });
  };

  const addChangePoint = () => {
    if (cp.phaseCChangePoints.length >= 6) return;
    setCp({
      phaseCChangePoints: [
        ...cp.phaseCChangePoints,
        { id: `cp_${Date.now()}`, fromMonthAfterPossession: 12, newEmi: 0 },
      ],
    });
  };

  const removeChangePoint = (id: string) => {
    setCp({ phaseCChangePoints: cp.phaseCChangePoints.filter((p) => p.id !== id) });
  };

  const updateChangePoint = (id: string, patch: Partial<CustomChangePoint>) => {
    setCp({
      phaseCChangePoints: cp.phaseCChangePoints.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  };

  // Build timeline summary
  const timelineRows: string[] = [];
  if (cp.phaseAType === "fixed") {
    timelineRows.push(`Month 1: You pay ${formatINR(cp.phaseAFixedAmount)}/month`);
  } else {
    for (const ms of [...cp.phaseAMilestones].sort((a, b) => a.fromMonth - b.fromMonth)) {
      timelineRows.push(`Month ${ms.fromMonth}: You pay ${formatINR(ms.amount)}/month`);
    }
  }
  if (cp.phaseAThirdPartyPays) {
    timelineRows.push(
      `Month ${cp.phaseAThirdPartyFromMonth}–${cp.phaseAThirdPartyToMonth}: ${cp.phaseAThirdPartyLabel || "Third party"} pays ${formatINR(cp.phaseAThirdPartyAmount)}/month`,
    );
  }
  const lumpStr = cp.phaseBLumpSum ? formatINR(cp.phaseBLumpSumAmount) : "₹0";
  const emiAfter = cp.phaseCAutoEmi ? fullEmi : cp.phaseCManualEmi;
  timelineRows.push(
    `Possession (Month ${value.possessionMonth}): Lump sum ${lumpStr} + EMI starts ${formatINR(emiAfter)}`,
  );
  if (cp.phaseCChanges && cp.phaseCChangeType === "custom") {
    for (const pt of [...cp.phaseCChangePoints].sort((a, b) => a.fromMonthAfterPossession - b.fromMonthAfterPossession)) {
      timelineRows.push(`Month ${value.possessionMonth + pt.fromMonthAfterPossession}: EMI changes to ${formatINR(pt.newEmi)}`);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        Custom Plan — Define Your Schedule
      </h2>

      {/* Phase A */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left text-sm font-semibold text-foreground hover:bg-muted/30">
          Phase A — What do you pay each month before possession?
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 pl-1">
          <RadioGroup
            value={cp.phaseAType}
            onValueChange={(v) => setCp({ phaseAType: v as "fixed" | "milestone" })}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fixed" id="pa_fixed" />
              <label htmlFor="pa_fixed" className="text-sm cursor-pointer">Fixed amount every month</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="milestone" id="pa_ms" />
              <label htmlFor="pa_ms" className="text-sm cursor-pointer">Milestone-based (changes at specific points)</label>
            </div>
          </RadioGroup>

          {cp.phaseAType === "fixed" && (
            <div className="sm:max-w-xs space-y-1.5">
              <Label>Monthly payment (₹)</Label>
              <CurrencyInput
                value={cp.phaseAFixedAmount}
                onValueChange={(n) => setCp({ phaseAFixedAmount: n })}
                placeholder="0"
              />
            </div>
          )}

          {cp.phaseAType === "milestone" && (
            <div className="space-y-3">
              {cp.phaseAMilestones.map((ms) => (
                <div key={ms.id} className="flex items-end gap-2 rounded-xl border border-border p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">From month</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={ms.fromMonth}
                      onChange={(e) => updateMilestone(ms.id, { fromMonth: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-9"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Pay (₹/month)</Label>
                    <CurrencyInput
                      value={ms.amount}
                      onValueChange={(n) => updateMilestone(ms.id, { amount: n })}
                      placeholder="0"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMilestone(ms.id)}
                    className="h-9 w-9 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {cp.phaseAMilestones.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
                  <Plus className="mr-1 h-4 w-4" /> Add milestone
                </Button>
              )}
            </div>
          )}

          {/* Third party */}
          <div className="flex items-center gap-3">
            <Switch
              checked={cp.phaseAThirdPartyPays}
              onCheckedChange={(v) => setCp({ phaseAThirdPartyPays: v })}
            />
            <Label className="text-sm">Is any portion paid by someone else?</Label>
          </div>
          {cp.phaseAThirdPartyPays && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">Who pays?</Label>
                <Input
                  value={cp.phaseAThirdPartyLabel}
                  onChange={(e) => setCp({ phaseAThirdPartyLabel: e.target.value })}
                  placeholder="e.g. Builder"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">How much per month? (₹)</Label>
                <CurrencyInput
                  value={cp.phaseAThirdPartyAmount}
                  onValueChange={(n) => setCp({ phaseAThirdPartyAmount: n })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From month</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={cp.phaseAThirdPartyFromMonth}
                  onChange={(e) => setCp({ phaseAThirdPartyFromMonth: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To month</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={cp.phaseAThirdPartyToMonth}
                  onChange={(e) => setCp({ phaseAThirdPartyToMonth: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9"
                />
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Phase B */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left text-sm font-semibold text-foreground hover:bg-muted/30">
          Phase B — What happens at possession?
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 pl-1">
          <div className="flex items-center gap-3">
            <Switch
              checked={cp.phaseBLumpSum}
              onCheckedChange={(v) => setCp({ phaseBLumpSum: v })}
            />
            <Label className="text-sm">Is there a lump sum due at possession?</Label>
          </div>
          {cp.phaseBLumpSum && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹)</Label>
                <CurrencyInput
                  value={cp.phaseBLumpSumAmount}
                  onValueChange={(n) => setCp({ phaseBLumpSumAmount: n })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={cp.phaseBLumpSumLabel}
                  onChange={(e) => setCp({ phaseBLumpSumLabel: e.target.value })}
                  placeholder="e.g. Accumulated interest"
                  className="h-9"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={cp.phaseBAddToPrincipal}
              onCheckedChange={(v) => setCp({ phaseBAddToPrincipal: v })}
            />
            <Label className="text-sm">Will you add anything to your principal at possession?</Label>
          </div>
          {cp.phaseBAddToPrincipal && (
            <div className="sm:max-w-xs pl-2 space-y-1">
              <Label className="text-xs">Amount (₹)</Label>
              <CurrencyInput
                value={cp.phaseBAddAmount}
                onValueChange={(n) => setCp({ phaseBAddAmount: n })}
                placeholder="0"
              />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Phase C */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left text-sm font-semibold text-foreground hover:bg-muted/30">
          Phase C — What do you pay after possession?
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 pl-1">
          <RadioGroup
            value={cp.phaseCAutoEmi ? "auto" : "manual"}
            onValueChange={(v) => setCp({ phaseCAutoEmi: v === "auto" })}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="pc_auto" />
              <label htmlFor="pc_auto" className="text-sm cursor-pointer">
                Calculate automatically from loan details ({formatINR(fullEmi)}/month)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="pc_manual" />
              <label htmlFor="pc_manual" className="text-sm cursor-pointer">I will enter manually</label>
            </div>
          </RadioGroup>

          {!cp.phaseCAutoEmi && (
            <div className="sm:max-w-xs space-y-1.5">
              <Label>EMI amount (₹)</Label>
              <CurrencyInput
                value={cp.phaseCManualEmi}
                onValueChange={(n) => setCp({ phaseCManualEmi: n })}
                placeholder="0"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={cp.phaseCChanges}
              onCheckedChange={(v) => setCp({ phaseCChanges: v })}
            />
            <Label className="text-sm">Does your EMI change over time?</Label>
          </div>

          {cp.phaseCChanges && (
            <div className="space-y-3">
              <RadioGroup
                value={cp.phaseCChangeType}
                onValueChange={(v) => setCp({ phaseCChangeType: v as typeof cp.phaseCChangeType })}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="increase_pct" id="pcc_inc" />
                  <label htmlFor="pcc_inc" className="text-sm cursor-pointer">Increases yearly</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="decrease_pct" id="pcc_dec" />
                  <label htmlFor="pcc_dec" className="text-sm cursor-pointer">Decreases yearly</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="pcc_cust" />
                  <label htmlFor="pcc_cust" className="text-sm cursor-pointer">Custom schedule</label>
                </div>
              </RadioGroup>

              {(cp.phaseCChangeType === "increase_pct" || cp.phaseCChangeType === "decrease_pct") && (
                <div className="sm:max-w-xs space-y-1.5">
                  <Label>% per year</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={50}
                    value={cp.phaseCChangePct || ""}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      setCp({ phaseCChangePct: Number.isFinite(n) ? n : 0 });
                    }}
                    placeholder="5"
                    className="h-9"
                  />
                </div>
              )}

              {cp.phaseCChangeType === "custom" && (
                <div className="space-y-3">
                  {cp.phaseCChangePoints.map((pt) => (
                    <div key={pt.id} className="flex items-end gap-2 rounded-xl border border-border p-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">From month after possession</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={pt.fromMonthAfterPossession}
                          onChange={(e) => updateChangePoint(pt.id, { fromMonthAfterPossession: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="h-9"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">New EMI (₹)</Label>
                        <CurrencyInput
                          value={pt.newEmi}
                          onValueChange={(n) => updateChangePoint(pt.id, { newEmi: n })}
                          placeholder="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChangePoint(pt.id)}
                        className="h-9 w-9 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {cp.phaseCChangePoints.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={addChangePoint}>
                      <Plus className="mr-1 h-4 w-4" /> Add change point
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Timeline summary */}
      {timelineRows.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Your custom payment timeline:
          </h3>
          {timelineRows.map((line, i) => (
            <p key={i} className="text-sm text-muted-foreground">{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}

// ────────────── Plan Comparison Section ──────────────
function PlanComparisonSection({ value }: { value: PaymentPlanInputs }) {
  const rows = computePlanComparison(value);
  if (rows.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left text-sm font-semibold text-foreground hover:bg-muted/30">
        Compare with Standard Pre-EMI
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="py-2 px-4" />
                <th className="py-2 px-4">Your Plan</th>
                <th className="py-2 px-4">Pre-EMI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2 px-4 text-muted-foreground">{r.label}</td>
                  <td
                    className={cn(
                      "py-2 px-4 font-medium",
                      r.yourPlanBetter === true && "bg-success-soft/50",
                      r.yourPlanBetter === false && "bg-warning-soft/50",
                    )}
                  >
                    {r.yourPlan}
                  </td>
                  <td
                    className={cn(
                      "py-2 px-4 font-medium",
                      r.yourPlanBetter === false && "bg-success-soft/50",
                      r.yourPlanBetter === true && "bg-warning-soft/50",
                    )}
                  >
                    {r.preEmi}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
