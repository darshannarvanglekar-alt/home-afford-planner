import * as React from "react";
import { CurrencyInput } from "./CurrencyInput";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type Finances,
  formatINR,
  surplus,
  totalIncome,
  totalOutflow,
} from "@/lib/plan-schema";

interface Props {
  value: Finances;
  onChange: (next: Finances) => void;
}

const EXPENSE_CARDS: Array<{
  key: keyof Finances["expenses"];
  emoji: string;
  label: string;
  helper: string;
}> = [
  { key: "housing", emoji: "🏠", label: "Housing & Utilities", helper: "rent, electricity, water, maintenance" },
  { key: "family", emoji: "👨‍👩‍👧", label: "Family & Dependents", helper: "school fees, childcare, elderly care" },
  { key: "health", emoji: "🏥", label: "Health & Protection", helper: "medical, health, term + car insurance" },
  { key: "daily", emoji: "🛒", label: "Daily Living", helper: "groceries, food, fuel, transport" },
  { key: "investments", emoji: "📈", label: "Investments & Savings", helper: "SIPs, FDs, RDs, PPF (monthly)" },
  { key: "discretionary", emoji: "🎉", label: "Discretionary", helper: "dining, travel, entertainment, shopping" },
];

export function Step1Finances({ value, onChange }: Props) {
  const set = <K extends keyof Finances>(section: K, patch: Partial<Finances[K]>) => {
    onChange({ ...value, [section]: { ...value[section], ...patch } });
  };

  const income = totalIncome(value);
  const outflow = totalOutflow(value);
  const net = surplus(value);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Tell us about your monthly finances
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          Enter your best monthly average. You can edit anything later.
        </p>
      </div>

      {/* INCOME */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Monthly Income</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Primary Salary">
            <CurrencyInput
              value={value.income.primarySalary}
              onValueChange={(n) => set("income", { primarySalary: n })}
            />
          </Field>
          <Field label="Additional Income">
            <CurrencyInput
              value={value.income.additionalIncome}
              onValueChange={(n) => set("income", { additionalIncome: n })}
              placeholder="freelance, rent, other"
            />
          </Field>
          <Field label="Family Contribution" className="sm:col-span-2">
            <CurrencyInput
              value={value.income.familyContribution}
              onValueChange={(n) => set("income", { familyContribution: n })}
              placeholder="spouse, parents (optional)"
            />
          </Field>
        </div>

        <div className="mt-5 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary-soft-foreground">
              Total Monthly Income
            </span>
            <span className="text-lg font-bold text-primary-soft-foreground">
              {formatINR(income)}
            </span>
          </div>
        </div>
      </section>

      {/* COMMITMENTS */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Existing Monthly Commitments</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Current EMIs total"
            helper="Total of all existing loan EMIs you pay"
          >
            <CurrencyInput
              value={value.commitments.emis}
              onValueChange={(n) => set("commitments", { emis: n })}
            />
          </Field>
          <Field label="Insurance premiums total / month">
            <CurrencyInput
              value={value.commitments.insurance}
              onValueChange={(n) => set("commitments", { insurance: n })}
            />
          </Field>
        </div>
      </section>

      {/* EXPENSES */}
      <section>
        <h2 className="text-base font-semibold text-foreground">Monthly Expenses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your typical monthly spend per category
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXPENSE_CARDS.map((c) => (
            <div
              key={c.key}
              className="rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                  {c.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.helper}</div>
                </div>
              </div>
              <div className="mt-3">
                <CurrencyInput
                  value={value.expenses[c.key]}
                  onValueChange={(n) => set("expenses", { [c.key]: n } as Partial<Finances["expenses"]>)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SUMMARY */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h3 className="text-base font-semibold text-foreground">Monthly Summary</h3>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label="Total Income" value={formatINR(income)} />
          <Row label="Total Expenses + Commitments" value={formatINR(outflow)} />
          <div className="my-2 h-px bg-border" />
          <Row
            label="Current Monthly Surplus"
            value={formatINR(net)}
            valueClass={cn(
              "text-lg font-bold",
              net >= 0 ? "text-success" : "text-destructive",
            )}
            labelClass="font-semibold text-foreground"
          />
        </dl>
      </section>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
  className,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      {children}
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function Row({
  label,
  value,
  labelClass,
  valueClass,
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-muted-foreground", labelClass)}>{label}</dt>
      <dd className={cn("font-semibold text-foreground", valueClass)}>{value}</dd>
    </div>
  );
}
