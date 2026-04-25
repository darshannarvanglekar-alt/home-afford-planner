import * as React from "react";
import { AlertCircle, ChevronDown, ShieldCheck, TriangleAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  calculateAffordabilityPlan,
  formatINR,
  type Finances,
  type Home,
  type Profile,
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