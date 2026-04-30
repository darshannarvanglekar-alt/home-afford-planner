import * as React from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronDown,
  Coins,
  GitCompareArrows,
  Landmark,
  Layers3,
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  ShieldCheck,
  Split,
  Trophy,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SaveScenarioButton } from "@/components/scenarios/SaveScenarioButton";
import { useAuth } from "@/lib/auth";
import { listScenarios } from "@/lib/scenarios";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { proBadgeText } from "@/lib/subscription";
import {
  calcEMI,
  calculateAffordabilityPlan,
  formatINR,
  type CurrentInvestment,
  type Finances,
  type Home,
  loanAmount,
  type Profile,
  summarizeInvestments,
  totalExpenses,
} from "@/lib/plan-schema";

interface Props {
  finances: Finances;
  investments: CurrentInvestment[];
  home: Home;
  profile: Profile;
  onFinancesChange?: (finances: Finances) => void;
  onHomeChange?: (home: Home) => void;
  onProfileChange?: (profile: Profile) => void;
  planName?: string;
  onPlanNameChange?: (name: string) => void;
  canUseProFeatures?: boolean;
  onUpgradeRequired?: (message: string) => void;
}

export function Step4Plan({
  finances,
  investments,
  home,
  profile,
  onFinancesChange,
  onHomeChange,
  onProfileChange,
  planName = "",
  onPlanNameChange,
  canUseProFeatures = true,
  onUpgradeRequired,
}: Props) {
  const [open, setOpen] = React.useState(true);
  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(planName);
  const safetyKey = `homeafford.safetyAllocation.${planName || "default"}`;
  const [safetyAllocation, setSafetyAllocation] = React.useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(safetyKey);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (safetyAllocation > 0) {
      window.localStorage.setItem(safetyKey, String(safetyAllocation));
    } else {
      window.localStorage.removeItem(safetyKey);
    }
  }, [safetyAllocation, safetyKey]);
  const plan = React.useMemo(
    () => calculateAffordabilityPlan(finances, home, profile),
    [finances, home, profile],
  );
  const investmentSummary = React.useMemo(
    () => summarizeInvestments(investments, home.possessionMonth),
    [investments, home.possessionMonth],
  );
  const targetCorpus = Math.max(
    100000,
    home.downPayment + home.registrationStampDuty + home.interiorBudget,
  );
  const corpusCoveredPct =
    targetCorpus > 0 ? Math.min(100, (investmentSummary.projectedCorpus / targetCorpus) * 100) : 0;
  const additionalCorpusNeeded = Math.max(0, targetCorpus - investmentSummary.projectedCorpus);
  const verdictTone = {
    safe: {
      label: "SAFE",
      icon: ShieldCheck,
      className: "bg-success-soft text-success-soft-foreground border-success/20",
    },
    stretch: {
      label: "STRETCH",
      icon: TriangleAlert,
      className: "bg-warning-soft text-warning-soft-foreground border-warning/20",
    },
    risky: {
      label: "RISKY",
      icon: AlertCircle,
      className: "bg-danger-soft text-danger-soft-foreground border-destructive/20",
    },
  }[plan.verdict];
  const VerdictIcon = verdictTone.icon;

  const ratioTone =
    plan.emiToIncomePct < 40
      ? "text-success"
      : plan.emiToIncomePct <= 50
        ? "text-warning"
        : "text-destructive";

  React.useEffect(() => setDraftName(planName), [planName]);

  const commitName = () => {
    onPlanNameChange?.(draftName.trim());
    setEditingName(false);
  };

  return (
    <div className="space-y-6">
      <header>
        {editingName ? (
          <Input
            value={draftName}
            autoFocus
            placeholder="Click to name your plan"
            className="h-auto border-0 px-0 py-1 text-2xl font-extrabold tracking-tight shadow-none focus-visible:ring-0 sm:text-3xl"
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName();
              if (event.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="flex max-w-full items-center gap-2 text-left"
            onClick={() => setEditingName(true)}
          >
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {planName || "Click to name your plan"}
            </h1>
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Here is how this home purchase fits your monthly cash flow.
        </p>
        {plan.surplusBeforeEmi <= 0 ? (
          <p className="mt-2 text-sm font-semibold text-destructive">
            Your current expenses exceed your income. Please review your numbers.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SaveScenarioButton
            finances={finances}
            investments={investments}
            home={home}
            profile={profile}
            safetyAllocation={safetyAllocation}
            defaultName={planName}
            variant="outline"
            className="min-h-11"
          />
          <SavedScenariosBanner />
        </div>
      </header>

      <section className={cn("rounded-2xl border p-5 shadow-soft sm:p-6", verdictTone.className)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background/55 px-4 py-2 text-base font-extrabold sm:text-sm">
              <VerdictIcon className="h-4 w-4" />
              {verdictTone.label}
            </div>
            <h2 className="mt-4 text-xl font-extrabold sm:text-2xl">{plan.headline}</h2>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 text-sm font-medium sm:grid-cols-3">
          <li>• Monthly surplus after EMI: {formatINR(plan.surplusAfterEmi)}</li>
          <li>• EMI as % of income: {plan.emiToIncomePct.toFixed(1)}%</li>
          <li>• Emergency fund: {plan.emergencyStatus}</li>
          <li>
            • Existing investments projected corpus by possession / purchase date:{" "}
            {formatINR(investmentSummary.projectedCorpus)}
          </li>
          <li>• Additional corpus needed: {formatINR(additionalCorpusNeeded)}</li>
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Monthly EMI" value={formatINR(plan.newEmi)} />
        <MetricCard
          label="Monthly Surplus"
          value={formatINR(plan.surplusAfterEmi)}
          valueClassName={plan.surplusAfterEmi >= 0 ? "text-success" : "text-destructive"}
        />
        <MetricCard
          label="EMI to Income Ratio"
          value={`${plan.emiToIncomePct.toFixed(1)}%`}
          valueClassName={ratioTone}
        />
        <MetricCard label="Emergency Fund Needed" value={formatINR(plan.emergencyFundNeeded)} />
        <MetricCard
          label="Target Covered"
          value={`${corpusCoveredPct.toFixed(0)}%`}
          valueClassName="text-success"
        />
      </section>

      {safetyAllocation > 0 && (
        <div className="rounded-2xl border border-success/20 bg-success-soft/55 p-4 text-sm font-semibold text-success-soft-foreground shadow-soft">
          Safety buffer allocation: {formatINR(safetyAllocation)}/month
        </div>
      )}

      <Button type="button" variant="outline" className="w-full" asChild>
        <Link to="/compare" search={{ planA: undefined }}>
          <GitCompareArrows className="h-4 w-4" />
          Compare with Another Property
        </Link>
      </Button>

      <SmartSuggestionsPanel
        finances={finances}
        investments={investments}
        home={home}
        profile={profile}
        onFinancesChange={onFinancesChange}
        onHomeChange={onHomeChange}
        onProfileChange={onProfileChange}
        canUseProFeatures={canUseProFeatures}
        onUpgradeRequired={onUpgradeRequired}
      />

      <CorpusBuilder
        finances={finances}
        investments={investments}
        home={home}
        planSurplus={plan.surplusAfterEmi}
        onSafetyAllocation={setSafetyAllocation}
      />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <Button
          type="button"
          variant="ghost"
          className="flex w-full justify-between px-0 text-left text-lg font-semibold hover:bg-transparent"
          onClick={() => setOpen((v) => !v)}
        >
          How we calculated this
          <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
        </Button>
        {open && (
          <div className="mt-5 space-y-5">
            {plan.layerScores.map((layer, index) => (
              <div key={layer.name} className="space-y-2" title={layerTooltip(index)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{layer.name}</p>
                    <p className="text-xs text-muted-foreground">{layer.label}</p>
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {layer.score}/100
                  </span>
                </div>
                <Progress value={layer.score} />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        HomeAfford is a scenario planning tool. All projections are illustrative and not financial,
        investment, or loan advice.
      </p>
    </div>
  );
}

type SuggestionType = "opportunity" | "warning" | "action";

interface SmartSuggestion {
  icon: string;
  title: string;
  explanation: string;
  impact: string;
  type: SuggestionType;
  simulation?: Partial<{
    monthlyInvestment: number;
    downPayment: number;
    possessionMonth: number;
    emergencyFundPref: Profile["emergencyFundPref"];
  }>;
}

function SmartSuggestionsPanel({
  finances,
  investments,
  home,
  profile,
  onFinancesChange,
  onHomeChange,
  onProfileChange,
  canUseProFeatures = true,
  onUpgradeRequired,
}: Props) {
  const [suggestions, setSuggestions] = React.useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [originalValues, setOriginalValues] = React.useState<{
    finances: Finances;
    home: Home;
    profile: Profile;
  } | null>(null);
  const plan = calculateAffordabilityPlan(finances, home, profile);

  const generateSuggestions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in to generate suggestions.");

      const principal = loanAmount(home);
      const totalInterest = Math.max(
        0,
        calcEMI(principal, home.interestRateA, home.tenureYears) * home.tenureYears * 12 -
          principal,
      );
      const targetCorpus = Math.max(
        100000,
        home.downPayment + home.registrationStampDuty + home.interiorBudget,
      );
      const currentInvestmentSummary = summarizeInvestments(investments, home.possessionMonth);
      const projectedCorpus = currentInvestmentSummary.projectedCorpus;
      const response = await fetch("/api/generate-plan-suggestions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile: {
            totalIncome: plan.totalIncome,
            totalExpenses: totalExpenses(finances),
            existingEMIs: finances.commitments.emis,
            newEMI: plan.newEmi,
            surplus: plan.surplusAfterEmi,
            investments: currentInvestmentSummary.monthlyCommitment,
            existingInvestmentCorpusToday: currentInvestmentSummary.currentCorpus,
            existingInvestmentProjectedCorpus: currentInvestmentSummary.projectedCorpus,
            existingInvestmentCoveragePct:
              targetCorpus > 0
                ? Math.min(100, (currentInvestmentSummary.projectedCorpus / targetCorpus) * 100)
                : 0,
            targetCorpus,
            projectedCorpus,
            corpusGap: Math.max(0, targetCorpus - projectedCorpus),
            monthsToPurchase: home.possessionMonth,
            emergencyFundMode: profile.emergencyFundPref,
            emergencyFundTarget: plan.emergencyFundNeeded,
            propertyCost: home.propertyCost,
            loanAmount: principal,
            interestRate: home.interestRateA,
            tenureYears: home.tenureYears,
            totalInterest,
            verdict: plan.verdict,
            emiToIncomeRatio: plan.emiToIncomePct,
            healthInsurance: profile.healthInsurance,
            dependents: profile.dependents,
            elderlyParents: profile.elderlyParents,
            propertyType: home.propertyType,
            discretionary: finances.expenses.discretionary,
          },
        }),
      });

      const payload = (await response.json()) as {
        suggestions?: SmartSuggestion[];
        error?: string;
      };
      if (!response.ok || !payload.suggestions?.length)
        throw new Error(payload.error ?? "We couldn't generate suggestions right now.");
      setSuggestions(payload.suggestions);
    } catch (err) {
      console.error("AI scenario suggestions failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Suggestions are taking longer than usual. Tap to retry.",
      );
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [
    finances,
    investments,
    home,
    profile,
    plan.emiToIncomePct,
    plan.emergencyFundNeeded,
    plan.newEmi,
    plan.surplusAfterEmi,
    plan.totalIncome,
    plan.verdict,
  ]);

  React.useEffect(() => {
    if (!canUseProFeatures) return;
    void generateSuggestions();
  }, [canUseProFeatures, generateSuggestions]);

  const applySuggestion = (suggestion: SmartSuggestion) => {
    if (!suggestion.simulation) return;
    if (!originalValues) setOriginalValues({ finances, home, profile });
    if (typeof suggestion.simulation.monthlyInvestment === "number") {
      console.info(
        "Scenario simulation monthly investment amount",
        Math.max(0, Math.round(suggestion.simulation.monthlyInvestment)),
      );
    }
    if (
      typeof suggestion.simulation.downPayment === "number" ||
      typeof suggestion.simulation.possessionMonth === "number"
    ) {
      onHomeChange?.({
        ...home,
        downPayment:
          typeof suggestion.simulation.downPayment === "number"
            ? Math.max(0, Math.round(suggestion.simulation.downPayment))
            : home.downPayment,
        possessionMonth:
          typeof suggestion.simulation.possessionMonth === "number"
            ? Math.max(1, Math.round(suggestion.simulation.possessionMonth))
            : home.possessionMonth,
      });
    }
    if (suggestion.simulation.emergencyFundPref) {
      onProfileChange?.({ ...profile, emergencyFundPref: suggestion.simulation.emergencyFundPref });
    }
  };

  const restoreOriginalValues = () => {
    if (!originalValues) return;
    onFinancesChange?.(originalValues.finances);
    onHomeChange?.(originalValues.home);
    onProfileChange?.(originalValues.profile);
    setOriginalValues(null);
  };

  if (!canUseProFeatures) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="pointer-events-none select-none blur-sm">
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">
            Ways to Improve Your Plan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on your numbers, here are scenarios worth exploring.
          </p>
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="h-4 w-44 rounded bg-primary/10" />
                <div className="mt-3 h-3 w-full rounded bg-primary/10" />
                <div className="mt-2 h-3 w-5/6 rounded bg-primary/10" />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="max-w-sm text-center">
            <p className="text-lg font-extrabold text-foreground">
              Upgrade to Pro to unlock scenario suggestions for your plan.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => onUpgradeRequired?.("Scenario suggestions are a Pro feature.")}
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">
            Ways to Improve Your Plan
          </h2>
          <span className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            {proBadgeText()}
          </span>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on your numbers, here are scenarios worth exploring.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-h-40 overflow-hidden rounded-xl border border-border bg-muted/40 p-4"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-primary/10" />
                  <div className="h-4 w-36 animate-pulse rounded bg-primary/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-primary/10" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-primary/10" />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm font-medium text-warning-soft-foreground">
            <p>Suggestions are taking longer than usual. Tap to retry.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={generateSuggestions}>
              Retry
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            Your plan is already well-optimised. Small tweaks are shown below in case you want to
            explore further.
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.title}-${index}`}
              suggestion={suggestion}
              onSimulate={() => applySuggestion(suggestion)}
            />
          ))
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="justify-start px-0"
          onClick={generateSuggestions}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Generate new suggestions →
        </Button>
        {originalValues && (
          <Button
            type="button"
            variant="ghost"
            className="justify-start px-0"
            onClick={restoreOriginalValues}
          >
            ← Restore my original values
          </Button>
        )}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
    </section>
  );
}

type CorpusRoute =
  | "monthlyInvestment"
  | "fixedSaving"
  | "lumpSum"
  | "pooledSaving"
  | "gold"
  | "recurringDeposit";

const DISCLAIMER =
  "HomeAfford is a scenario planning tool. All projections are illustrative and not financial, investment, or loan advice.";

const routeCards: Array<{
  id: CorpusRoute;
  title: string;
  description: string;
  icon: React.ElementType;
  defaultRate: number;
  monthly: boolean;
  stepEnabled: boolean;
}> = [
  {
    id: "monthlyInvestment",
    title: "Monthly Investment",
    description: "A monthly market-linked route using your assumed return.",
    icon: TrendingUp,
    defaultRate: 10,
    monthly: true,
    stepEnabled: true,
  },
  {
    id: "fixedSaving",
    title: "Monthly Fixed Return Saving",
    description: "A monthly fixed-return saving route using your assumed return.",
    icon: Landmark,
    defaultRate: 7,
    monthly: true,
    stepEnabled: true,
  },
  {
    id: "lumpSum",
    title: "Lump Sum Investment",
    description: "A one-time amount that grows until possession or purchase.",
    icon: Banknote,
    defaultRate: 8,
    monthly: false,
    stepEnabled: false,
  },
  {
    id: "pooledSaving",
    title: "Chit-Style Pooled Saving",
    description: "A monthly pooled saving route using your assumed return.",
    icon: WalletCards,
    defaultRate: 9,
    monthly: true,
    stepEnabled: false,
  },
  {
    id: "gold",
    title: "Gold Accumulation",
    description: "A monthly gold accumulation route using your assumed return.",
    icon: Coins,
    defaultRate: 8,
    monthly: true,
    stepEnabled: false,
  },
  {
    id: "recurringDeposit",
    title: "Recurring Deposit",
    description: "A monthly recurring deposit route using your assumed return.",
    icon: Layers3,
    defaultRate: 7,
    monthly: true,
    stepEnabled: false,
  },
];

type RouteAllocation = { id: CorpusRoute; amount: number; rate: number; stepUp: boolean };

function CorpusBuilder({
  finances,
  investments,
  home,
  planSurplus,
  onSafetyAllocation,
}: {
  finances: Finances;
  investments: CurrentInvestment[];
  home: Home;
  planSurplus: number;
  onSafetyAllocation: (amount: number) => void;
}) {
  const targetDefault = Math.max(
    100000,
    home.downPayment + home.registrationStampDuty + home.interiorBudget,
  );
  const existing = React.useMemo(
    () => summarizeInvestments(investments, home.possessionMonth),
    [investments, home.possessionMonth],
  );
  const additionalNeeded = Math.max(0, targetDefault - existing.projectedCorpus);
  const [target, setTarget] = React.useState(targetDefault);
  const [timeline, setTimeline] = React.useState(Math.max(1, home.possessionMonth));
  const [allocations, setAllocations] = React.useState<RouteAllocation[]>([
    {
      id: "monthlyInvestment",
      amount: Math.max(0, Math.round(Math.min(planSurplus, 25000))),
      rate: 10,
      stepUp: false,
    },
  ]);

  React.useEffect(() => setTarget(targetDefault), [targetDefault]);
  React.useEffect(() => setTimeline(Math.max(1, home.possessionMonth)), [home.possessionMonth]);

  const selected = new Set(allocations.map((item) => item.id));
  const result = React.useMemo(
    () => buildCombinedProjection(allocations, timeline, existing.projectedCorpus, target),
    [allocations, timeline, existing.projectedCorpus, target],
  );
  const totalMonthly = allocations.reduce(
    (sum, item) => sum + (isMonthlyRoute(item.id) ? item.amount : 0),
    0,
  );
  const diff = result.final - target;
  const surplusDelta = Math.abs(planSurplus - totalMonthly);

  const toggleRoute = (id: CorpusRoute) => {
    if (selected.has(id) && allocations.length > 1) {
      setAllocations(allocations.filter((item) => item.id !== id));
      return;
    }
    if (!selected.has(id)) {
      const card = routeCards.find((item) => item.id === id)!;
      setAllocations([...allocations, { id, amount: 0, rate: card.defaultRate, stepUp: false }]);
    }
  };

  const updateAllocation = (id: CorpusRoute, patch: Partial<RouteAllocation>) => {
    setAllocations(allocations.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateMarketRates = (rate: number) => {
    setAllocations(
      allocations.map((item) => (item.id === "monthlyInvestment" ? { ...item, rate } : item)),
    );
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">Corpus Builder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Illustrative scenarios based on your entered amounts and assumed rates.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm font-semibold text-primary-soft-foreground">
          Your existing investments are already building {formatINR(existing.projectedCorpus)}{" "}
          toward your target. You need {formatINR(Math.max(0, target - existing.projectedCorpus))}{" "}
          more.
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Current Savings" value={formatINR(existing.currentCorpus)} />
          <MetricCard
            label="Existing Corpus by Target Date"
            value={formatINR(existing.projectedCorpus)}
            valueClassName="text-success"
          />
          <MetricCard label="Additional Corpus Needed" value={formatINR(additionalNeeded)} />
        </div>

        <div className="mt-6">
          <h3 className="text-base font-extrabold text-foreground">
            How do you want to build the additional corpus needed?
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {routeCards.map((card) => {
              const Icon = card.icon;
              const isSelected = selected.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={cn(
                    "relative rounded-2xl border bg-background p-4 text-left transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/15"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() => toggleRoute(card.id)}
                >
                  {isSelected ? (
                    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 pr-8 font-extrabold text-foreground">{card.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sticky top-24 z-10 mt-6 rounded-2xl border border-border bg-background/95 p-4 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-1 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
            <span>Total monthly allocation: {formatINR(totalMonthly)}</span>
            <span>Your available monthly surplus: {formatINR(planSurplus)}</span>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              totalMonthly > planSurplus ? "text-warning" : "text-success",
            )}
          >
            {totalMonthly > planSurplus
              ? `Your total allocation exceeds your available surplus by ${formatINR(surplusDelta)}. Consider adjusting the amounts.`
              : `You have ${formatINR(surplusDelta)} unallocated surplus remaining.`}
          </p>
        </div>

        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-muted/25 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField label="Target corpus" value={target} onChange={setTarget} />
            <NumberField label="Timeline in months" value={timeline} onChange={setTimeline} />
          </div>
          <ScenarioChips
            rates={[8, 10, 12]}
            selected={allocations.find((item) => item.id === "monthlyInvestment")?.rate ?? 10}
            onSelect={updateMarketRates}
          />
          <div className="space-y-3">
            {allocations.map((allocation) => (
              <AllocationRow
                key={allocation.id}
                allocation={allocation}
                onChange={(patch) => updateAllocation(allocation.id, patch)}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Combined Projected Corpus"
            value={formatINR(result.final)}
            valueClassName="text-primary"
          />
          <MetricCard label="Target Corpus" value={formatINR(target)} />
          <MetricCard
            label={diff >= 0 ? "Surplus" : "Shortfall"}
            value={formatINR(Math.abs(diff))}
            valueClassName={diff >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background p-4">
          {result.breakdown.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-muted-foreground">{routeTitle(item.id)}</span>
              <span className="font-extrabold text-foreground">{formatINR(item.value)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 h-64 rounded-2xl border border-border bg-background p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={(value) => `${value}m`}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                tickFormatter={(value) => compactINR(Number(value))}
                width={48}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                formatter={(value) => formatINR(Number(value))}
                labelFormatter={(label) => `Month ${label}`}
                contentStyle={{
                  background: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  borderRadius: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Combined corpus"
                stroke="var(--color-chart-1)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="target"
                name="Target corpus"
                stroke="var(--color-chart-3)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This projection is an illustrative scenario based on the return rate and contribution you
          entered.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
      </section>

      <SafetyBufferPlanner
        finances={finances}
        defaultMonthly={Math.max(0, Math.round(totalMonthly * 0.25))}
        onInclude={onSafetyAllocation}
      />
    </>
  );
}

function AllocationRow({
  allocation,
  onChange,
}: {
  allocation: RouteAllocation;
  onChange: (patch: Partial<RouteAllocation>) => void;
}) {
  const card = routeCards.find((item) => item.id === allocation.id)!;
  const Icon = card.icon;
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <p className="font-extrabold text-foreground">{card.title}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CurrencyField
          label={card.monthly ? "Monthly contribution amount" : "Lump sum amount"}
          value={allocation.amount}
          onChange={(amount) => onChange({ amount })}
        />
        <NumberField
          label="Assumed return rate (%)"
          value={allocation.rate}
          onChange={(rate) => onChange({ rate })}
        />
      </div>
      {card.stepEnabled ? (
        <div className="mt-4">
          <StepUpControl
            enabled={allocation.stepUp}
            setEnabled={(stepUp) => onChange({ stepUp })}
            value={10}
            onChange={() => undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

function StepUpControl({
  enabled,
  setEnabled,
  value,
  onChange,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-foreground">
          Increase my contribution every year
        </p>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="mt-4">
          <SliderField
            label={`Annual increase: ${value}% per year`}
            value={value}
            min={5}
            max={20}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

function ScenarioChips({
  rates,
  selected,
  onSelect,
}: {
  rates: number[];
  selected: number;
  onSelect: (rate: number) => void;
}) {
  const labels = ["Conservative", "Moderate", "Optimistic"];
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rates.map((rate, index) => (
          <Button
            key={rate}
            type="button"
            variant={selected === rate ? "default" : "outline"}
            onClick={() => onSelect(rate)}
          >
            {rate}% {labels[index]}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Return scenario chips update all selected market-linked routes. Returns shown are assumed
        rates for scenario illustration only.
      </p>
    </div>
  );
}

function SafetyBufferPlanner({
  finances,
  defaultMonthly,
  onInclude,
}: {
  finances: Finances;
  defaultMonthly: number;
  onInclude: (amount: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [expenses, setExpenses] = React.useState(Math.round(totalExpenses(finances)));
  const [months, setMonths] = React.useState(6);
  const [monthlySetAside, setMonthlySetAside] = React.useState(defaultMonthly);
  const target = expenses * months;
  const readyIn = monthlySetAside > 0 ? Math.ceil(target / monthlySetAside) : 0;
  const progress = target > 0 ? Math.min(100, (monthlySetAside / target) * 100) : 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex gap-3">
          <Shield className="mt-1 h-5 w-5 text-primary" />
          <span>
            <span className="block text-lg font-extrabold text-foreground">
              Safety Buffer Planner
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Protect your corpus plan from unexpected expenses.
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      <p className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
        A safety buffer means your home corpus investment stays untouched even if something
        unexpected happens — job change, medical expense, or home repair.
      </p>
      {open && (
        <div className="mt-5 space-y-5 animate-step-slide">
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label="Monthly household expenses"
              value={expenses}
              onChange={setExpenses}
            />
            <CurrencyField
              label="Monthly amount to set aside for safety buffer"
              value={monthlySetAside}
              onChange={setMonthlySetAside}
            />
          </div>
          <div>
            <p className="text-sm font-extrabold text-foreground">Target buffer size</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[3, 6, 9].map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={months === m ? "default" : "outline"}
                  onClick={() => setMonths(m)}
                >
                  {m} Months
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Total safety buffer target" value={formatINR(target)} />
              <MetricCard
                label="Time to build it"
                value={monthlySetAside > 0 ? `${readyIn} months` : "Add amount"}
              />
            </div>
            <div className="mt-4">
              <Progress value={progress} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              At {formatINR(monthlySetAside)}/month, your safety buffer is ready in {readyIn || 0}{" "}
              months.
            </p>
          </div>
          <Button type="button" className="w-full" onClick={() => onInclude(monthlySetAside)}>
            Include {formatINR(monthlySetAside)}/month in my plan
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
        </div>
      )}
    </section>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="mt-2 flex items-center rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="text-muted-foreground">₹</span>
        <Input
          inputMode="numeric"
          type="number"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <Input
        className="mt-2"
        inputMode="numeric"
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary-soft-foreground">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([next]) => onChange(next ?? min)}
      />
    </div>
  );
}

function buildCombinedProjection(
  allocations: RouteAllocation[],
  timeline: number,
  existingProjected: number,
  target: number,
) {
  const months = Math.max(1, Math.round(timeline || 1));
  const points = Array.from({ length: months }, (_, index) => {
    const month = index + 1;
    const routeTotal = allocations.reduce((sum, item) => sum + routeValueAtMonth(item, month), 0);
    return { month, total: routeTotal + (existingProjected * month) / months, target };
  });
  const last = points[points.length - 1];
  const breakdown = allocations.map((item) => ({
    id: item.id,
    value: routeValueAtMonth(item, months),
  }));
  return { points, final: last.total, breakdown };
}

function routeValueAtMonth(route: RouteAllocation, month: number) {
  if (!isMonthlyRoute(route.id)) return futureValue(route.amount, route.rate, month);
  return futureValueMonthly(route.amount, route.rate, month, route.stepUp, 10);
}

function isMonthlyRoute(route: CorpusRoute) {
  return route !== "lumpSum";
}
function routeTitle(route: CorpusRoute) {
  return routeCards.find((item) => item.id === route)?.title ?? route;
}
function futureValueMonthly(
  monthly: number,
  annualRate: number,
  months: number,
  step: boolean,
  stepPct: number,
) {
  let value = 0;
  const r = annualRate / 12 / 100;
  for (let m = 1; m <= months; m += 1) {
    const annualBump = step ? Math.floor((m - 1) / 12) : 0;
    value = (value + monthly * Math.pow(1 + stepPct / 100, annualBump)) * (1 + r);
  }
  return value;
}
function futureValue(amount: number, annualRate: number, months: number) {
  return amount * Math.pow(1 + annualRate / 12 / 100, months);
}
function compactINR(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
  return `₹${Math.round(value)}`;
}

function layerTooltip(index: number) {
  return (
    [
      "Checks if your income covers all essential expenses",
      "Checks monthly cash flow after paying the new EMI",
      "Checks if emergency fund stays protected",
      "Checks if EMI is a safe percentage of your income",
      "Checks if investments can continue after the purchase",
    ][index] ?? "Explains this affordability layer"
  );
}

function SuggestionCard({
  suggestion,
  onSimulate,
}: {
  suggestion: SmartSuggestion;
  onSimulate: () => void;
}) {
  const tone = {
    opportunity: "border-l-success bg-success-soft/45",
    warning: "border-l-warning bg-warning-soft/55",
    action: "border-l-destructive bg-danger-soft/55",
  }[suggestion.type];

  return (
    <article className={cn("rounded-xl border border-border border-l-4 p-4", tone)}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          {suggestion.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-foreground">{suggestion.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{suggestion.explanation}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-soft-foreground">
              {suggestion.impact}
            </span>
            <Button type="button" variant="outline" className="min-h-11" onClick={onSimulate}>
              Simulate This →
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-xl font-extrabold text-foreground", valueClassName)}>{value}</p>
    </div>
  );
}

function SavedScenariosBanner() {
  const { user } = useAuth();
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    const refresh = () => setCount(listScenarios(user?.id).length);
    refresh();
    window.addEventListener("homeafford:scenarios-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("homeafford:scenarios-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user?.id]);
  if (count < 1) return null;
  return (
    <Link
      to="/scenarios"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
    >
      You have {count} saved scenario{count === 1 ? "" : "s"}. Compare them →
    </Link>
  );
}
