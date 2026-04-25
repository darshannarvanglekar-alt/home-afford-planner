import * as React from "react";
import { Camera, FileUp, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { CurrencyInput } from "./CurrencyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  type Home,
  type PropertyType,
  type BuilderStage,
  calcEMI,
  formatINR,
  loanAmount,
} from "@/lib/plan-schema";

interface Props {
  value: Home;
  onChange: (next: Home) => void;
}

interface ExtractedStage {
  stageName: string;
  month: number;
  bankAmount: number;
  selfAmount: number;
  totalAmount: number;
}

const PROPERTY_OPTIONS: Array<{
  key: PropertyType;
  emoji: string;
  label: string;
}> = [
  { key: "ready", emoji: "🏠", label: "Home — Ready to Move" },
  { key: "construction", emoji: "🏗️", label: "Home — Under Construction" },
  { key: "plot", emoji: "🟫", label: "Plot" },
];

const TENURE_OPTIONS = [5, 10, 15, 20, 25, 30];
const POSSESSION_MONTHS = Array.from({ length: 60 }, (_, i) => i + 1);

export function Step2Home({ value, onChange }: Props) {
  const set = <K extends keyof Home>(k: K, v: Home[K]) =>
    onChange({ ...value, [k]: v });

  const loan = loanAmount(value);
  const emiA = calcEMI(loan, value.interestRateA, value.tenureYears);
  const emiB =
    value.interestRateB && value.interestRateB > 0
      ? calcEMI(loan, value.interestRateB, value.tenureYears)
      : null;

  const setStage = (id: string, patch: Partial<BuilderStage>) => {
    onChange({
      ...value,
      builderStages: value.builderStages.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  };

  const addStage = () => {
    const next = value.builderStages.length + 1;
    onChange({
      ...value,
      builderStages: [
        ...value.builderStages,
        {
          id: `s${Date.now()}`,
          name: `Stage ${next}`,
          month: next === 1 ? 1 : (value.builderStages[value.builderStages.length - 1]?.month ?? 0) + 6,
          bankPays: 0,
          youPay: 0,
        },
      ],
    });
  };

  const removeStage = (id: string) => {
    onChange({
      ...value,
      builderStages: value.builderStages.filter((s) => s.id !== id),
    });
  };

  const totalBank = value.builderStages.reduce((a, s) => a + (s.bankPays || 0), 0);
  const totalSelf = value.builderStages.reduce((a, s) => a + (s.youPay || 0), 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Tell us about the home you want to buy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the details of the property and your loan plan.
        </p>
      </header>

      {/* Property type */}
      <section className="space-y-3">
        <Label className="text-base font-semibold text-foreground">
          What are you buying?
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PROPERTY_OPTIONS.map((opt) => {
            const selected = value.propertyType === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => set("propertyType", opt.key)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border-2 bg-card p-4 text-left shadow-soft transition-all hover:border-primary/50",
                  selected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border",
                )}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-sm font-semibold text-foreground">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Property details */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Property details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="propertyCost">Property Cost</Label>
            <CurrencyInput
              id="propertyCost"
              value={value.propertyCost}
              onValueChange={(n) => set("propertyCost", n)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="downPayment">Your Own Contribution / Down Payment</Label>
            <CurrencyInput
              id="downPayment"
              value={value.downPayment}
              onValueChange={(n) => set("downPayment", n)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Amount you will pay from your savings
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-primary/10 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-primary/80">
            Loan Amount
          </div>
          <div className="mt-0.5 text-xl font-bold text-primary">
            {formatINR(loan)}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">City / Location</Label>
          <Input
            id="city"
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="e.g., Bengaluru"
          />
        </div>
      </section>

      {/* Loan details */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Loan Details</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rateA">Expected interest rate (%)</Label>
            <Input
              id="rateA"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={50}
              value={Number.isFinite(value.interestRateA) ? value.interestRateA : ""}
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value);
                set("interestRateA", Number.isFinite(n) ? n : 0);
              }}
              placeholder="8.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rateB">Compare with alternate rate (%) — optional</Label>
            <Input
              id="rateB"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={50}
              value={value.interestRateB ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  set("interestRateB", undefined);
                  return;
                }
                const n = Number.parseFloat(raw);
                set("interestRateB", Number.isFinite(n) ? n : undefined);
              }}
              placeholder="e.g., 9.0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tenure">Loan Tenure (Years)</Label>
            <Select
              value={String(value.tenureYears)}
              onValueChange={(v) => set("tenureYears", Number.parseInt(v, 10))}
            >
              <SelectTrigger id="tenure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENURE_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} years
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-primary/10 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-primary/80">
              Monthly EMI @ Rate A
            </div>
            <div className="mt-0.5 text-xl font-bold text-primary">
              {formatINR(emiA)}
            </div>
          </div>
          {emiB !== null && (
            <div className="rounded-xl bg-accent/40 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/70">
                Monthly EMI @ Rate B
              </div>
              <div className="mt-0.5 text-xl font-bold text-foreground">
                {formatINR(emiB)}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Conditional: under construction */}
      {value.propertyType === "construction" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Builder Payment Plan</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter each payment stage. Most builders have 3–5 stages.
            </p>
          </div>

          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <div className="inline-block min-w-full px-5 sm:px-6">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Stage Name</th>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3">Bank Pays</th>
                    <th className="py-2 px-3">You Pay</th>
                    <th className="py-2 px-3">Total</th>
                    <th className="py-2 pl-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {value.builderStages.map((s) => {
                    const total = (s.bankPays || 0) + (s.youPay || 0);
                    return (
                      <tr key={s.id} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3">
                          <Input
                            value={s.name}
                            onChange={(e) => setStage(s.id, { name: e.target.value })}
                            placeholder="Stage 1"
                            className="min-w-[8rem]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={s.month}
                            onChange={(e) =>
                              setStage(s.id, {
                                month: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <CurrencyInput
                            value={s.bankPays}
                            onValueChange={(n) => setStage(s.id, { bankPays: n })}
                            placeholder="0"
                            className="min-w-[8rem]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <CurrencyInput
                            value={s.youPay}
                            onValueChange={(n) => setStage(s.id, { youPay: n })}
                            placeholder="0"
                            className="min-w-[8rem]"
                          />
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-foreground">
                          {formatINR(total)}
                        </td>
                        <td className="py-2 pl-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => removeStage(s.id)}
                            disabled={value.builderStages.length <= 1}
                            aria-label="Remove stage"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStage}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </Button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-primary/10 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-primary/80">
                Total Loan from Bank
              </div>
              <div className="mt-0.5 text-lg font-bold text-primary">
                {formatINR(totalBank)}
              </div>
            </div>
            <div className="rounded-xl bg-accent/40 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/70">
                Total Your Contribution
              </div>
              <div className="mt-0.5 text-lg font-bold text-foreground">
                {formatINR(totalSelf)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Conditional: ready to move */}
      {value.propertyType === "ready" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-base font-semibold text-foreground">One-time costs</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="stamp">Registration & Stamp Duty</Label>
              <CurrencyInput
                id="stamp"
                value={value.registrationStampDuty}
                onValueChange={(n) => set("registrationStampDuty", n)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Typically 5–7% of property value
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interior">Interior / Renovation Budget</Label>
              <CurrencyInput
                id="interior"
                value={value.interiorBudget}
                onValueChange={(n) => set("interiorBudget", n)}
                placeholder="0"
              />
            </div>
          </div>
        </section>
      )}

      {/* Possession */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="possession">
            When do you expect to get possession or move in?
          </Label>
          <Select
            value={String(value.possessionMonth)}
            onValueChange={(v) => set("possessionMonth", Number.parseInt(v, 10))}
          >
            <SelectTrigger id="possession" className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSSESSION_MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  Month {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
