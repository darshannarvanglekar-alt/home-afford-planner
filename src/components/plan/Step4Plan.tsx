import * as React from "react";
import { AlertCircle, Banknote, ChevronDown, Coins, GitCompareArrows, Landmark, Layers3, Loader2, Pencil, RefreshCw, Shield, ShieldCheck, TrendingUp, TriangleAlert, WalletCards } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  type Finances,
  type Home,
  loanAmount,
  type Profile,
  totalCommitments,
  totalExpenses,
} from "@/lib/plan-schema";

interface Props {
  finances: Finances;
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

export function Step4Plan({ finances, home, profile, onFinancesChange, onHomeChange, onProfileChange, planName = "", onPlanNameChange, canUseProFeatures = true, onUpgradeRequired }: Props) {
  const [open, setOpen] = React.useState(true);
  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(planName);
  const [safetyAllocation, setSafetyAllocation] = React.useState(0);
  const plan = React.useMemo(() => calculateAffordabilityPlan(finances, home, profile), [finances, home, profile]);
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
          <button type="button" className="flex max-w-full items-center gap-2 text-left" onClick={() => setEditingName(true)}>
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {planName || "Click to name your plan"}
            </h1>
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Here is how this home purchase fits your monthly cash flow.
        </p>
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

      <SmartSuggestionsPanel finances={finances} home={home} profile={profile} onFinancesChange={onFinancesChange} onHomeChange={onHomeChange} onProfileChange={onProfileChange} canUseProFeatures={canUseProFeatures} onUpgradeRequired={onUpgradeRequired} />

      <CorpusBuilder finances={finances} home={home} planSurplus={plan.surplusAfterEmi} onSafetyAllocation={setSafetyAllocation} />

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
                  <span className="text-sm font-bold text-primary tabular-nums">{layer.score}/100</span>
                </div>
                <Progress value={layer.score} />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        HomeAfford is a scenario planning tool. All projections are illustrative and not financial, investment, or loan advice.
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

function SmartSuggestionsPanel({ finances, home, profile, onFinancesChange, onHomeChange, onProfileChange, canUseProFeatures = true, onUpgradeRequired }: Props) {
  const [suggestions, setSuggestions] = React.useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [originalValues, setOriginalValues] = React.useState<{ finances: Finances; home: Home; profile: Profile } | null>(null);
  const plan = calculateAffordabilityPlan(finances, home, profile);

  const generateSuggestions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in to generate suggestions.");

      const principal = loanAmount(home);
      const totalInterest = Math.max(0, calcEMI(principal, home.interestRateA, home.tenureYears) * home.tenureYears * 12 - principal);
      const targetCorpus = Math.max(100000, home.downPayment + home.registrationStampDuty + home.interiorBudget);
      const projectedCorpus = futureValueMonthly(finances.expenses.investments, 10, Math.max(1, home.possessionMonth), false, 0);
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
            investments: finances.expenses.investments,
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

      const payload = await response.json() as { suggestions?: SmartSuggestion[]; error?: string };
      if (!response.ok || !payload.suggestions?.length) throw new Error(payload.error ?? "We couldn't generate suggestions right now.");
      setSuggestions(payload.suggestions);
    } catch (err) {
      console.error("AI scenario suggestions failed", err);
      setError(err instanceof Error ? err.message : "Suggestions are taking longer than usual. Tap to retry.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [finances, home, profile, plan.emiToIncomePct, plan.emergencyFundNeeded, plan.newEmi, plan.surplusAfterEmi, plan.totalIncome, plan.verdict]);

  React.useEffect(() => {
    if (!canUseProFeatures) return;
    void generateSuggestions();
  }, [canUseProFeatures, generateSuggestions]);

  if (!canUseProFeatures) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="pointer-events-none select-none blur-sm">
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">✨ Your Personalised Action Plan</h2>
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
            <p className="text-lg font-extrabold text-foreground">✨ Upgrade to Pro to unlock personalised AI suggestions for your plan.</p>
            <Button type="button" className="mt-4" onClick={() => onUpgradeRequired?.("AI personalised suggestions are a Pro feature.")}>Upgrade to Pro</Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">✨ Your Personalised Action Plan</h2>
          <span className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{proBadgeText()}</span>
          <p className="mt-1 text-sm text-muted-foreground">AI-generated suggestions based on your actual numbers</p>
        </div>
        <Button type="button" variant="outline" onClick={generateSuggestions} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate Suggestions
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <>
          <p className="text-sm font-medium text-muted-foreground">Generating your personalised suggestions...</p>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
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
          <div className="rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm font-medium text-warning-soft-foreground">AI analysis is temporarily unavailable. Please fill in the details manually below.</div>
        ) : (
          suggestions.map((suggestion, index) => <SuggestionCard key={`${suggestion.title}-${index}`} suggestion={suggestion} />)
        )}
      </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
    </section>
  );
}

type CorpusRoute = "monthlyInvestment" | "fixedSaving" | "lumpSum" | "pooledSaving" | "gold" | "blended";
type RouteA = "monthlyInvestment" | "lumpSum";
type RouteB = "fixedSaving" | "pooledSaving";

const DISCLAIMER = "HomeAfford is a scenario planning tool. All projections are illustrative and not financial, investment, or loan advice.";

const routeCards: Array<{ id: CorpusRoute; title: string; description: string; icon: React.ElementType }> = [
  { id: "monthlyInvestment", title: "Monthly Investment", description: "You invest a fixed amount every month. Returns vary based on market conditions.", icon: TrendingUp },
  { id: "fixedSaving", title: "Monthly Fixed Return Saving", description: "You save a fixed amount every month at a fixed return rate. Like a recurring deposit.", icon: Landmark },
  { id: "lumpSum", title: "Lump Sum Investment", description: "You invest a larger amount once and let it grow over time.", icon: Banknote },
  { id: "pooledSaving", title: "Chit-Style Pooled Saving", description: "You contribute monthly to a group pool and receive a lump sum at a chosen point in the cycle.", icon: WalletCards },
  { id: "gold", title: "Gold Accumulation", description: "You buy gold periodically. Returns are variable and linked to gold price movements.", icon: Coins },
  { id: "blended", title: "Blended Approach", description: "You split your monthly surplus across two routes for a balance of growth and safety.", icon: Layers3 },
];

function CorpusBuilder({ finances, home, planSurplus, onSafetyAllocation }: { finances: Finances; home: Home; planSurplus: number; onSafetyAllocation: (amount: number) => void }) {
  const targetDefault = Math.max(100000, home.downPayment + home.registrationStampDuty + home.interiorBudget);
  const [route, setRoute] = React.useState<CorpusRoute>("monthlyInvestment");
  const [monthly, setMonthly] = React.useState(Math.max(0, Math.round(Math.min(planSurplus, 25000))));
  const [lumpSum, setLumpSum] = React.useState(Math.max(0, home.downPayment || 100000));
  const [timeline, setTimeline] = React.useState(60);
  const [target, setTarget] = React.useState(targetDefault);
  const [rate, setRate] = React.useState(10);
  const [fixedRate, setFixedRate] = React.useState(7);
  const [chitRate, setChitRate] = React.useState(9);
  const [chitReceiveMonth, setChitReceiveMonth] = React.useState(12);
  const [stepUp, setStepUp] = React.useState(false);
  const [stepPct, setStepPct] = React.useState(10);
  const [routeA, setRouteA] = React.useState<RouteA>("monthlyInvestment");
  const [routeB, setRouteB] = React.useState<RouteB>("fixedSaving");
  const [amountA, setAmountA] = React.useState(Math.max(0, Math.round(Math.min(planSurplus / 2, 15000))));
  const [amountB, setAmountB] = React.useState(Math.max(0, Math.round(Math.min(planSurplus / 2, 10000))));
  const [routeBRate, setRouteBRate] = React.useState(7);

  const result = React.useMemo(() => buildCorpusProjection({ route, monthly, lumpSum, timeline, rate, fixedRate, chitRate, chitReceiveMonth, stepUp, stepPct, routeA, routeB, amountA, amountB, routeBRate }), [amountA, amountB, chitRate, chitReceiveMonth, fixedRate, lumpSum, monthly, rate, route, routeA, routeB, routeBRate, stepPct, stepUp, timeline]);
  const diff = result.final - target;
  const marketRates = route === "gold" ? [6, 8, 10] : [8, 10, 12];
  const monthlyTotal = route === "blended" && routeA === "monthlyInvestment" ? amountA + amountB : route === "blended" ? amountB : monthly;

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">Corpus Builder</h2>
          <p className="mt-1 text-sm text-muted-foreground">Illustrative scenarios based on your entered amounts and assumed rates.</p>
        </div>

        <div className="mt-5">
          <h3 className="text-base font-extrabold text-foreground">How do you want to build your corpus?</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {routeCards.map((card) => {
              const Icon = card.icon;
              const selected = route === card.id;
              return (
                <button key={card.id} type="button" className={cn("rounded-2xl border bg-background p-4 text-left transition-all", selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/50")} onClick={() => setRoute(card.id)}>
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-extrabold text-foreground">{card.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-muted/25 p-4">
          <RouteInputs route={route} monthly={monthly} setMonthly={setMonthly} lumpSum={lumpSum} setLumpSum={setLumpSum} timeline={timeline} setTimeline={setTimeline} rate={rate} setRate={setRate} fixedRate={fixedRate} setFixedRate={setFixedRate} chitRate={chitRate} setChitRate={setChitRate} chitReceiveMonth={chitReceiveMonth} setChitReceiveMonth={setChitReceiveMonth} stepUp={stepUp} setStepUp={setStepUp} stepPct={stepPct} setStepPct={setStepPct} routeA={routeA} setRouteA={setRouteA} routeB={routeB} setRouteB={setRouteB} amountA={amountA} setAmountA={setAmountA} amountB={amountB} setAmountB={setAmountB} routeBRate={routeBRate} setRouteBRate={setRouteBRate} planSurplus={planSurplus} marketRates={marketRates} />
          <CurrencyField label="Target corpus" value={target} onChange={setTarget} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Projected Corpus" value={formatINR(result.final)} valueClassName="text-primary" />
          <MetricCard label="Target Corpus" value={formatINR(target)} />
          <MetricCard label={diff >= 0 ? "Surplus" : "Shortfall"} value={formatINR(Math.abs(diff))} valueClassName={diff >= 0 ? "text-success" : "text-destructive"} />
        </div>

        <div className="mt-5 h-64 rounded-2xl border border-border bg-background p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={(value) => `${value}m`} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tickFormatter={(value) => compactINR(Number(value))} width={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip formatter={(value) => formatINR(Number(value))} labelFormatter={(label) => `Month ${label}`} contentStyle={{ background: "var(--color-card)", borderColor: "var(--color-border)", borderRadius: "12px" }} />
              <Line type="monotone" dataKey="flat" name="Fixed monthly amount" stroke="var(--color-chart-1)" strokeWidth={3} dot={false} />
              {result.hasStep && <Line type="monotone" dataKey="step" name="With annual increase" stroke="var(--color-chart-3)" strokeWidth={3} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {result.hasStep && <p className="mt-3 text-sm font-medium text-success">With a {stepPct}% annual increase, you reach your target {monthsEarlier(result.points, target)} months earlier.</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">This projection is an illustrative scenario based on the return rate and contribution you entered.</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
      </section>

      <SafetyBufferPlanner finances={finances} defaultMonthly={Math.max(0, Math.round(monthlyTotal * 0.25))} onInclude={onSafetyAllocation} />
    </>
  );
}

function RouteInputs(props: {
  route: CorpusRoute; monthly: number; setMonthly: (n: number) => void; lumpSum: number; setLumpSum: (n: number) => void; timeline: number; setTimeline: (n: number) => void; rate: number; setRate: (n: number) => void; fixedRate: number; setFixedRate: (n: number) => void; chitRate: number; setChitRate: (n: number) => void; chitReceiveMonth: number; setChitReceiveMonth: (n: number) => void; stepUp: boolean; setStepUp: (v: boolean) => void; stepPct: number; setStepPct: (n: number) => void; routeA: RouteA; setRouteA: (v: RouteA) => void; routeB: RouteB; setRouteB: (v: RouteB) => void; amountA: number; setAmountA: (n: number) => void; amountB: number; setAmountB: (n: number) => void; routeBRate: number; setRouteBRate: (n: number) => void; planSurplus: number; marketRates: number[];
}) {
  const showMarket = ["monthlyInvestment", "lumpSum", "gold", "blended"].includes(props.route);
  const showStep = props.route === "monthlyInvestment" || props.route === "fixedSaving";
  return (
    <div className="space-y-5 animate-step-slide">
      {props.route === "blended" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Route A" value={props.routeA} onChange={(value) => props.setRouteA(value as RouteA)} options={[{ value: "monthlyInvestment", label: "Monthly Investment" }, { value: "lumpSum", label: "Lump Sum" }]} />
          <CurrencyField label={props.routeA === "lumpSum" ? "Route A lump sum amount" : "Route A monthly amount"} value={props.amountA} onChange={props.setAmountA} />
          <SelectField label="Route B" value={props.routeB} onChange={(value) => props.setRouteB(value as RouteB)} options={[{ value: "fixedSaving", label: "Monthly Fixed Return Saving" }, { value: "pooledSaving", label: "Chit-Style Pooled Saving" }]} />
          <CurrencyField label="Route B monthly amount" value={props.amountB} onChange={props.setAmountB} />
          <NumberField label="Timeline in months" value={props.timeline} onChange={props.setTimeline} />
          <NumberField label="Route B assumed annual return (%)" value={props.routeBRate} onChange={props.setRouteBRate} />
          {props.routeA === "monthlyInvestment" && <p className={cn("sm:col-span-2 rounded-xl border p-3 text-sm font-medium", props.amountA + props.amountB > props.planSurplus ? "border-destructive/20 bg-danger-soft text-danger-soft-foreground" : "border-success/20 bg-success-soft text-success-soft-foreground")}>Total monthly allocation: {formatINR(props.amountA + props.amountB)}{props.amountA + props.amountB > props.planSurplus ? " — exceeds entered monthly surplus" : ""}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {props.route === "lumpSum" ? <CurrencyField label="Lump sum amount" value={props.lumpSum} onChange={props.setLumpSum} /> : <CurrencyField label={props.route === "gold" ? "Monthly gold purchase amount" : "Monthly contribution amount"} value={props.monthly} onChange={props.setMonthly} />}
          <NumberField label={props.route === "pooledSaving" ? "Total chit cycle duration in months" : "Timeline in months"} value={props.timeline} onChange={props.setTimeline} />
          {props.route === "fixedSaving" && <NumberField label="Assumed annual return (%)" value={props.fixedRate} onChange={props.setFixedRate} />}
          {props.route === "pooledSaving" && <NumberField label="Effective annual return (%)" value={props.chitRate} onChange={props.setChitRate} />}
        </div>
      )}

      {props.route === "pooledSaving" && <SliderField label={`Month at which lump sum is received: ${props.chitReceiveMonth}`} value={props.chitReceiveMonth} min={1} max={Math.max(1, props.timeline)} onChange={props.setChitReceiveMonth} />}
      {showStep && <StepUpControl enabled={props.stepUp} setEnabled={props.setStepUp} value={props.stepPct} onChange={props.setStepPct} />}
      {showMarket && <ScenarioChips rates={props.marketRates} selected={props.rate} onSelect={props.setRate} />}
      {props.route === "gold" && <p className="rounded-xl border border-warning/20 bg-warning-soft p-3 text-sm font-medium text-warning-soft-foreground">Gold returns are historically variable. These are illustrative scenarios only.</p>}
    </div>
  );
}

function StepUpControl({ enabled, setEnabled, value, onChange }: { enabled: boolean; setEnabled: (v: boolean) => void; value: number; onChange: (n: number) => void }) {
  return <div className="rounded-2xl border border-border bg-background p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-foreground">Increase my contribution every year</p><Switch checked={enabled} onCheckedChange={setEnabled} /></div>{enabled && <div className="mt-4"><SliderField label={`Annual increase: ${value}% per year`} value={value} min={5} max={20} onChange={onChange} /></div>}</div>;
}

function ScenarioChips({ rates, selected, onSelect }: { rates: number[]; selected: number; onSelect: (rate: number) => void }) {
  const labels = ["Conservative", "Moderate", "Optimistic"];
  return <div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{rates.map((rate, index) => <Button key={rate} type="button" variant={selected === rate ? "default" : "outline"} onClick={() => onSelect(rate)}>{rate}% {labels[index]}</Button>)}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Returns shown are assumed rates for scenario illustration only. Actual returns vary.</p></div>;
}

function SafetyBufferPlanner({ finances, defaultMonthly, onInclude }: { finances: Finances; defaultMonthly: number; onInclude: (amount: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [expenses, setExpenses] = React.useState(Math.round(totalExpenses(finances)));
  const [months, setMonths] = React.useState(6);
  const [monthlySetAside, setMonthlySetAside] = React.useState(defaultMonthly);
  const target = expenses * months;
  const readyIn = monthlySetAside > 0 ? Math.ceil(target / monthlySetAside) : 0;
  const progress = target > 0 ? Math.min(100, (monthlySetAside / target) * 100) : 0;
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"><button type="button" className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setOpen((v) => !v)}><span className="flex gap-3"><Shield className="mt-1 h-5 w-5 text-primary" /><span><span className="block text-lg font-extrabold text-foreground">Safety Buffer Planner</span><span className="mt-1 block text-sm text-muted-foreground">Protect your corpus plan from unexpected expenses.</span></span></span><ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")} /></button><p className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">A safety buffer means your home corpus investment stays untouched even if something unexpected happens — job change, medical expense, or home repair.</p>{open && <div className="mt-5 space-y-5 animate-step-slide"><div className="grid gap-4 sm:grid-cols-2"><CurrencyField label="Monthly household expenses" value={expenses} onChange={setExpenses} /><CurrencyField label="Monthly amount to set aside for safety buffer" value={monthlySetAside} onChange={setMonthlySetAside} /></div><div><p className="text-sm font-extrabold text-foreground">Target buffer size</p><div className="mt-2 grid grid-cols-3 gap-2">{[3, 6, 9].map((m) => <Button key={m} type="button" variant={months === m ? "default" : "outline"} onClick={() => setMonths(m)}>{m} Months</Button>)}</div></div><div className="rounded-2xl border border-border bg-background p-4"><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="Total safety buffer target" value={formatINR(target)} /><MetricCard label="Time to build it" value={monthlySetAside > 0 ? `${readyIn} months` : "Add amount"} /></div><div className="mt-4"><Progress value={progress} /></div><p className="mt-3 text-sm text-muted-foreground">At {formatINR(monthlySetAside)}/month, your safety buffer is ready in {readyIn || 0} months.</p></div><Button type="button" className="w-full" onClick={() => onInclude(monthlySetAside)}>Include {formatINR(monthlySetAside)}/month in my plan</Button><p className="text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p></div>}</section>;
}

function CurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label className="block"><span className="text-sm font-semibold text-foreground">{label}</span><div className="mt-2 flex items-center rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"><span className="text-muted-foreground">₹</span><Input inputMode="numeric" type="number" min={0} value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" /></div></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label className="block"><span className="text-sm font-semibold text-foreground">{label}</span><Input className="mt-2" inputMode="numeric" type="number" min={0} value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className="text-sm font-semibold text-foreground">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function SliderField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <div><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-foreground">{label}</p><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary-soft-foreground">{value}</span></div><Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next ?? min)} /></div>;
}

function buildCorpusProjection(input: { route: CorpusRoute; monthly: number; lumpSum: number; timeline: number; rate: number; fixedRate: number; chitRate: number; chitReceiveMonth: number; stepUp: boolean; stepPct: number; routeA: RouteA; routeB: RouteB; amountA: number; amountB: number; routeBRate: number }) {
  const months = Math.max(1, Math.round(input.timeline || 1));
  const points = Array.from({ length: months }, (_, index) => {
    const month = index + 1;
    const flat = corpusAtMonth(input, month, false);
    return { month, flat, step: input.stepUp ? corpusAtMonth(input, month, true) : undefined };
  });
  const last = points[points.length - 1];
  return { points, final: input.stepUp ? Number(last.step ?? last.flat) : last.flat, hasStep: input.stepUp && (input.route === "monthlyInvestment" || input.route === "fixedSaving") };
}

function corpusAtMonth(input: Parameters<typeof buildCorpusProjection>[0], month: number, step: boolean) {
  if (input.route === "lumpSum") return futureValue(input.lumpSum, input.rate, month);
  if (input.route === "pooledSaving") return futureValue(input.monthly * Math.min(month, input.chitReceiveMonth), input.chitRate, Math.max(0, month - input.chitReceiveMonth));
  if (input.route === "blended") {
    const a = input.routeA === "lumpSum" ? futureValue(input.amountA, input.rate, month) : futureValueMonthly(input.amountA, input.rate, month, false, 0);
    const b = input.routeB === "pooledSaving" ? futureValue(input.amountB * Math.min(month, Math.max(1, Math.round(month / 2))), input.routeBRate, Math.max(0, Math.round(month / 2))) : futureValueMonthly(input.amountB, input.routeBRate, month, false, 0);
    return a + b;
  }
  const annualRate = input.route === "fixedSaving" ? input.fixedRate : input.rate;
  return futureValueMonthly(input.monthly, annualRate, month, step, input.stepPct);
}

function futureValueMonthly(monthly: number, annualRate: number, months: number, step: boolean, stepPct: number) { let value = 0; const r = annualRate / 12 / 100; for (let m = 1; m <= months; m += 1) { const annualBump = step ? Math.floor((m - 1) / 12) : 0; value = (value + monthly * Math.pow(1 + stepPct / 100, annualBump)) * (1 + r); } return value; }
function futureValue(amount: number, annualRate: number, months: number) { return amount * Math.pow(1 + annualRate / 12 / 100, months); }
function monthsEarlier(points: Array<{ flat: number; step?: number }>, target: number) { const flat = points.findIndex((p) => p.flat >= target); const stepped = points.findIndex((p) => Number(p.step ?? 0) >= target); return flat >= 0 && stepped >= 0 ? Math.max(0, flat - stepped) : 0; }
function compactINR(value: number) { if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`; if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`; if (value >= 1000) return `₹${Math.round(value / 1000)}K`; return `₹${Math.round(value)}`; }

function layerTooltip(index: number) {
  return [
    "Checks if your income covers all essential expenses",
    "Checks monthly cash flow after paying the new EMI",
    "Checks if emergency fund stays protected",
    "Checks if EMI is a safe percentage of your income",
    "Checks if investments can continue after the purchase",
  ][index] ?? "Explains this affordability layer";
}

function SuggestionCard({ suggestion }: { suggestion: SmartSuggestion }) {
  const tone = {
    opportunity: "border-l-success bg-success-soft/45",
    warning: "border-l-warning bg-warning-soft/55",
    action: "border-l-destructive bg-danger-soft/55",
  }[suggestion.type];

  return (
    <article className={cn("rounded-xl border border-border border-l-4 p-4", tone)}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">{suggestion.icon}</span>
        <div className="min-w-0">
          <h3 className="font-extrabold text-foreground">{suggestion.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{suggestion.explanation}</p>
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