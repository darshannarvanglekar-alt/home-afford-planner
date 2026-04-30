import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "./CurrencyInput";
import { cn } from "@/lib/utils";
import {
  formatINR,
  investmentDefaultRates,
  investmentTypeLabels,
  isLumpSumInvestment,
  summarizeInvestments,
  type CurrentInvestment,
  type InvestmentType,
} from "@/lib/plan-schema";

interface Props {
  value: CurrentInvestment[];
  possessionMonth: number;
  onChange: (next: CurrentInvestment[]) => void;
}

const investmentOptions = Object.entries(investmentTypeLabels) as Array<[InvestmentType, string]>;

export function StepCurrentInvestments({ value, possessionMonth, onChange }: Props) {
  const summary = summarizeInvestments(value, possessionMonth);

  const addRow = () => {
    if (value.length >= 10) return;
    onChange([...value, newInvestment()]);
  };

  const updateRow = (id: string, patch: Partial<CurrentInvestment>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Optional</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">My Current Investments</h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          Tell us about investments you already have running. We will use these to calculate your existing corpus trajectory.
        </p>
      </header>

      <section className="space-y-4">
        {value.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">No current investments added. You can skip this step.</p>
          </div>
        ) : (
          value.map((investment, index) => (
            <InvestmentRow
              key={investment.id}
              investment={investment}
              index={index}
              onUpdate={(patch) => updateRow(investment.id, patch)}
              onRemove={() => onChange(value.filter((item) => item.id !== investment.id))}
            />
          ))
        )}

        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={addRow} disabled={value.length >= 10}>
          <Plus className="h-4 w-4" />
          Add another investment
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Section Summary</h2>
        <p className="mt-1 text-xs text-muted-foreground">Estimated based on your entered assumptions</p>
        <dl className="mt-4 space-y-3 text-sm">
          <SummaryRow label="Total monthly investment commitment" value={formatINR(summary.monthlyCommitment)} />
          <SummaryRow label="Estimated existing corpus value today" value={formatINR(summary.currentCorpus)} />
          <SummaryRow label="Projected corpus from existing investments at possession / purchase date" value={formatINR(summary.projectedCorpus)} />
        </dl>
      </section>
    </div>
  );
}

function InvestmentRow({ investment, index, onUpdate, onRemove }: { investment: CurrentInvestment; index: number; onUpdate: (patch: Partial<CurrentInvestment>) => void; onRemove: () => void }) {
  const lumpSum = isLumpSumInvestment(investment.type);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-extrabold text-foreground">Investment {index + 1}</h2>
        <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onRemove} aria-label="Remove investment">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-foreground">Investment type</span>
          <select
            value={investment.type}
            onChange={(event) => {
              const type = event.target.value as InvestmentType;
              onUpdate({ type, assumedReturn: investmentDefaultRates[type] });
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {investmentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-foreground">{lumpSum ? "Current value (₹)" : "Monthly contribution amount (₹)"}</span>
          <CurrencyInput className="mt-2" value={investment.amount} onValueChange={(amount) => onUpdate({ amount })} />
        </label>
        <NumberField label="Assumed annual return (%)" value={investment.assumedReturn} onChange={(assumedReturn) => onUpdate({ assumedReturn })} step="0.1" />
        <NumberField label="How many months has this been running?" value={investment.monthsRunning} onChange={(monthsRunning) => onUpdate({ monthsRunning })} />
        <div className="rounded-xl border border-border bg-muted/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Is this investment continuing?</span>
            <Switch checked={investment.continuing} onCheckedChange={(continuing) => onUpdate({ continuing })} />
          </div>
          {investment.continuing && !lumpSum ? <NumberField className="mt-4" label="How many more months will it continue?" value={investment.monthsRemaining} onChange={(monthsRemaining) => onUpdate({ monthsRemaining })} /> : null}
        </div>
      </div>
    </article>
  );
}

function NumberField({ label, value, onChange, step = "1", className }: { label: string; value: number; onChange: (n: number) => void; step?: string; className?: string }) {
  return <label className={cn("block", className)}><span className="text-sm font-semibold text-foreground">{label}</span><Input className="mt-2 min-h-11" inputMode="decimal" type="number" min={0} step={step} value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-extrabold text-foreground">{value}</dd></div>;
}

function newInvestment(): CurrentInvestment {
  return { id: crypto.randomUUID(), type: "monthly_market", amount: 0, assumedReturn: 10, monthsRunning: 0, continuing: true, monthsRemaining: 12 };
}