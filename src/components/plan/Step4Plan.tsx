import * as React from "react";
import { AlertCircle, ChevronDown, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
}

export function Step4Plan({ finances, home, profile }: Props) {
  const [open, setOpen] = React.useState(true);
  const plan = calculateAffordabilityPlan(finances, home, profile);
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Your affordability plan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here is how this home purchase fits your monthly cash flow.
        </p>
      </header>

      <section className={cn("rounded-2xl border p-5 shadow-soft sm:p-6", verdictTone.className)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/55 px-3 py-1 text-sm font-extrabold">
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <SmartSuggestionsPanel finances={finances} home={home} profile={profile} />

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
            {plan.layerScores.map((layer) => (
              <div key={layer.name} className="space-y-2">
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
    </div>
  );
}

type SuggestionType = "opportunity" | "warning" | "action";

interface SmartSuggestion {
  icon: string;
  title: string;
  explanation: string;
  type: SuggestionType;
}

function SmartSuggestionsPanel({ finances, home, profile }: Props) {
  const [suggestions, setSuggestions] = React.useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
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
      setError(err instanceof Error ? err.message : "We couldn't generate suggestions right now.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [finances, home, profile, plan.emiToIncomePct, plan.emergencyFundNeeded, plan.newEmi, plan.surplusAfterEmi, plan.totalIncome, plan.verdict]);

  React.useEffect(() => {
    void generateSuggestions();
  }, [generateSuggestions]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">✨ Your Personalised Action Plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">AI-generated suggestions based on your actual numbers</p>
        </div>
        <Button type="button" variant="outline" onClick={generateSuggestions} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate Suggestions
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-primary/10" />
                <div className="h-4 w-36 animate-pulse rounded bg-primary/10" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-primary/10" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-primary/10" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground">Analysing your finances...</p>
            </div>
          ))
        ) : error ? (
          <div className="rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm font-medium text-warning-soft-foreground">{error}</div>
        ) : (
          suggestions.map((suggestion, index) => <SuggestionCard key={`${suggestion.title}-${index}`} suggestion={suggestion} />)
        )}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        These suggestions are for planning purposes only and do not constitute financial or investment advice. Please consult a qualified financial advisor before making decisions.
      </p>
    </section>
  );
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