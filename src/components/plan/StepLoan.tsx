import * as React from "react";
import { CurrencyInput } from "./CurrencyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Home, calcEMI, formatINR, loanAmount } from "@/lib/plan-schema";

interface Props {
  value: Home;
  onChange: (next: Home) => void;
}

const TENURE_OPTIONS = [5, 10, 15, 20, 25, 30];

export function StepLoan({ value, onChange }: Props) {
  const set = <K extends keyof Home>(k: K, v: Home[K]) => onChange({ ...value, [k]: v });

  const loan = loanAmount(value);
  const emiA = calcEMI(loan, value.interestRateA, value.tenureYears);
  const emiB =
    value.interestRateB && value.interestRateB > 0
      ? calcEMI(loan, value.interestRateB, value.tenureYears)
      : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Your Loan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your down payment and loan terms. Numbers update live.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Down payment</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="propertyCostRO">Property Cost</Label>
            <CurrencyInput
              id="propertyCostRO"
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
          <div className="mt-0.5 text-xl font-bold text-primary">{formatINR(loan)}</div>
        </div>
      </section>

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
            <div className="mt-0.5 text-xl font-bold text-primary">{formatINR(emiA)}</div>
          </div>
          {emiB !== null && (
            <div className="rounded-xl bg-accent/40 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/70">
                Monthly EMI @ Rate B
              </div>
              <div className="mt-0.5 text-xl font-bold text-foreground">{formatINR(emiB)}</div>
            </div>
          )}
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        HomeAfford is a scenario planning tool. All projections are illustrative and not financial,
        investment, or loan advice.
      </p>
    </div>
  );
}
