import * as React from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { CurrencyInput } from "./CurrencyInput";
import { FrequencySelect } from "./FrequencySelect";
import { MonthYearPicker, formatYearMonth } from "./MonthYearPicker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { proBadgeText } from "@/lib/subscription";
import {
  type AmountWithFrequency,
  awfMonthly,
  type ExistingEmi,
  type Finances,
  formatINR,
  monthlyEquivalent,
  type PaymentFrequency,
  surplus,
  totalCommitments,
  totalExpenses,
  totalIncome,
} from "@/lib/plan-schema";

interface ExtractedStatementValues {
  primarySalary: number;
  additionalIncome: number;
  familyContribution: number;
  existingEMIs: number;
  insurancePremiums: number;
  housingUtilities: number;
  familyDependents: number;
  healthProtection: number;
  dailyLiving: number;
  investmentsSavings: number;
  discretionary: number;
}

interface Props {
  value: Finances;
  onChange: (next: Finances) => void;
  canUseProFeatures?: boolean;
  onUpgradeRequired?: (message: string) => void;
}

const EXPENSE_CARDS: Array<{
  key: keyof Finances["expenses"];
  emoji: string;
  label: string;
  helper: string;
}> = [
  {
    key: "housing",
    emoji: "🏠",
    label: "Rent or current housing cost",
    helper: "rent, maintenance, current housing cost",
  },
  {
    key: "family",
    emoji: "🧾",
    label: "Household groceries and utilities",
    helper: "groceries, electricity, water, regular utilities",
  },
  {
    key: "health",
    emoji: "🏥",
    label: "Medical / health costs",
    helper: "medical bills and recurring health costs",
  },
  {
    key: "daily",
    emoji: "🚌",
    label: "Transportation",
    helper: "fuel, commute, vehicle running costs",
  },
  {
    key: "schoolFees",
    emoji: "🎓",
    label: "School / education fees",
    helper: "school, education, classes, learning costs",
  },
  {
    key: "discretionary",
    emoji: "🎉",
    label: "Entertainment, dining and other living expenses",
    helper: "dining, entertainment, shopping, other regular living costs",
  },
];

export function Step1Finances({
  value,
  onChange,
  canUseProFeatures = true,
  onUpgradeRequired,
}: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [analysing, setAnalysing] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [aiFields, setAiFields] = React.useState<Set<string>>(new Set());
  const inputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof Finances>(section: K, patch: Partial<Finances[K]>) => {
    onChange({ ...value, [section]: { ...value[section], ...patch } });
  };

  const validateAndAddFiles = (incoming: FileList | File[]) => {
    if (!canUseProFeatures) {
      onUpgradeRequired?.(
        "AI statement analysis is a Pro feature. Upgrade to unlock instant auto-fill.",
      );
      return;
    }
    setMessage(null);
    const selected = Array.from(incoming);
    const valid: File[] = [];
    for (const file of selected) {
      const ok =
        file.type === "application/pdf" ||
        file.type.includes("csv") ||
        /\.(pdf|csv)$/i.test(file.name);
      if (!ok) {
        setMessage({ type: "error", text: "Please upload a PDF or CSV file only." });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: "error", text: "File too large. Please upload files under 10MB." });
        continue;
      }
      valid.push(file);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, 6));
  };

  const applyExtractedValues = (extracted: ExtractedStatementValues, months: number) => {
    onChange({
      ...value,
      income: {
        primarySalary: Math.round(extracted.primarySalary),
        additionalIncome: Math.round(extracted.additionalIncome),
        familyContribution: Math.round(extracted.familyContribution),
      },
      commitments: {
        ...value.commitments,
        emis: Math.round(extracted.existingEMIs),
        insurance: Math.round(extracted.insurancePremiums),
      },
      expenses: {
        housing: { amount: Math.round(extracted.housingUtilities), frequency: "monthly" },
        family: { amount: Math.round(extracted.familyDependents), frequency: "monthly" },
        health: { amount: Math.round(extracted.healthProtection), frequency: "monthly" },
        daily: { amount: Math.round(extracted.dailyLiving), frequency: "monthly" },
        schoolFees: { amount: Math.round(extracted.investmentsSavings), frequency: "monthly" },
        discretionary: { amount: Math.round(extracted.discretionary), frequency: "monthly" },
      },
    });
    setAiFields(
      new Set([
        "income.primarySalary",
        "income.additionalIncome",
        "income.familyContribution",
        "commitments.emis",
        "commitments.insurance",
        "expenses.housing",
        "expenses.family",
        "expenses.health",
        "expenses.daily",
        "expenses.discretionary",
      ]),
    );
    setMessage({
      type: "success",
      text: `✅ AI has filled in your details from ${months} months of statements. Please review and edit anything that looks wrong. ✅ File deleted from our servers after analysis.`,
    });
  };

  const handleAnalyze = async () => {
    if (!canUseProFeatures) {
      onUpgradeRequired?.(
        "AI statement analysis is a Pro feature. Upgrade to unlock instant auto-fill.",
      );
      return;
    }
    if (files.length === 0) return;
    setAnalysing(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in before analysing statements.");
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const res = await fetch("/api/analyze-bank-statement", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await res.json()) as {
        values?: ExtractedStatementValues;
        months?: number;
        error?: string;
      };
      if (!res.ok || !data.values)
        throw new Error(
          data.error ||
            "We couldn't read this file automatically. Please fill in the details below manually.",
        );
      applyExtractedValues(data.values, data.months ?? 3);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setMessage({
        type: "error",
        text: "AI analysis is temporarily unavailable. Please fill in the details manually below.",
      });
    } finally {
      setAnalysing(false);
    }
  };

  const income = totalIncome(value);
  const livingExpenses = totalExpenses(value);
  const existingEmis = totalCommitments(value);
  const outflow = livingExpenses + existingEmis;
  const net = surplus(value);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Let AI fill this for you
            </h2>
            <Badge variant="secondary">{proBadgeText()}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Upload your last 3-6 months of statements. Our AI will auto-detect your income, living
            expenses, and EMIs.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && validateAndAddFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            validateAndAddFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          className="mt-5 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/35 px-4 py-10 text-center transition hover:border-primary/50 hover:bg-primary-soft/40"
        >
          <Upload className="h-8 w-8 text-primary" />
          <span className="mt-3 text-sm font-semibold text-foreground">
            📄 Drop your statement here or click to upload
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            PDF or CSV · up to 6 files · 10MB each
          </span>
        </button>
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <Badge key={`${file.name}-${index}`} variant="outline" className="gap-1.5 py-1">
                {file.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          🔒 Your files are analysed instantly and permanently deleted. We never store uploaded
          statements.
        </p>
        {message && (
          <div
            className={cn(
              "mt-4 rounded-xl border px-4 py-3 text-sm",
              message.type === "success"
                ? "border-success/25 bg-success-soft text-success-soft-foreground"
                : "border-destructive/25 bg-danger-soft text-danger-soft-foreground",
            )}
          >
            {message.text}
          </div>
        )}
        <Button
          className="mt-5 w-full sm:w-auto"
          onClick={handleAnalyze}
          disabled={files.length === 0 || analysing}
        >
          {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : "✨"}
          {analysing ? "AI is reading your statement..." : "Analyse with AI"}
        </Button>
        {analysing && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or enter manually below</span>
        <span className="h-px flex-1 bg-border" />
      </div>

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
          <Field label="Primary Salary" ai={aiFields.has("income.primarySalary")}>
            <CurrencyInput
              value={value.income.primarySalary}
              onValueChange={(n) => set("income", { primarySalary: n })}
            />
          </Field>
          <Field label="Additional Income" ai={aiFields.has("income.additionalIncome")}>
            <CurrencyInput
              value={value.income.additionalIncome}
              onValueChange={(n) => set("income", { additionalIncome: n })}
              placeholder="freelance, rent, other"
            />
          </Field>
          <Field
            label="Family Contribution"
            className="sm:col-span-2"
            ai={aiFields.has("income.familyContribution")}
          >
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

      {/* COMMITMENTS — structured EMI list with end dates (Change 5) */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Existing Loan EMIs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add each loan EMI separately. Including the end date helps us reflect the windfall when an
          EMI closes.
        </p>
        <EmiList value={value} onChange={onChange} />
      </section>

      {/* EXPENSES */}
      <section>
        <h2 className="text-base font-semibold text-foreground">Monthly Expenses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your typical amount and how often you pay. Investments are captured separately in the
          next step.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXPENSE_CARDS.map((c) => {
            const current: AmountWithFrequency = value.expenses[c.key] ?? {
              amount: 0,
              frequency: "monthly",
            };
            return (
              <div
                key={c.key}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-soft",
                  aiFields.has(`expenses.${c.key}`)
                    ? "border-primary/30 border-l-4 border-l-primary"
                    : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                    {c.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {c.label}
                      {aiFields.has(`expenses.${c.key}`) ? (
                        <Badge variant="secondary">AI</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.helper}</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <CurrencyInput
                    value={current.amount}
                    onValueChange={(n) =>
                      set("expenses", {
                        [c.key]: { amount: n, frequency: current.frequency },
                      } as Partial<Finances["expenses"]>)
                    }
                  />
                  <FrequencySelect
                    value={current.frequency}
                    onChange={(f) =>
                      set("expenses", {
                        [c.key]: { amount: current.amount, frequency: f },
                      } as Partial<Finances["expenses"]>)
                    }
                    className="min-h-11 w-full sm:w-[140px]"
                  />
                </div>
                {current.frequency !== "monthly" && current.amount > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Monthly equivalent: {formatINR(monthlyEquivalent(current.amount, current.frequency))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      💡 Paying this monthly makes it easier to track your surplus and plan
                      investments.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* SUMMARY */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h3 className="text-base font-semibold text-foreground">Monthly Summary</h3>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label="Total Income" value={formatINR(income)} />
          <Row label="Monthly Expenses" value={formatINR(livingExpenses)} />
          <Row label="Existing Loan EMIs (active today)" value={formatINR(existingEmis)} />
          <div className="my-2 h-px bg-border" />
          <Row
            label="Current Monthly Surplus"
            value={formatINR(net)}
            valueClass={cn("text-lg font-bold", net >= 0 ? "text-success" : "text-destructive")}
            labelClass="font-semibold text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Based on monthly equivalents of all your expenses.
          </p>
        </dl>
      </section>
    </div>
  );
}

function EmiList({
  value,
  onChange,
}: {
  value: Finances;
  onChange: (next: Finances) => void;
}) {
  const list = value.commitments.emiList ?? [];
  const update = (next: ExistingEmi[]) => {
    onChange({ ...value, commitments: { ...value.commitments, emiList: next } });
  };
  const addRow = () => {
    update([
      ...list,
      { id: crypto.randomUUID(), label: "", amount: 0, endDate: undefined },
    ]);
  };
  const updateRow = (id: string, patch: Partial<ExistingEmi>) => {
    update(list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeRow = (id: string) => update(list.filter((e) => e.id !== id));

  return (
    <div className="mt-4 space-y-3">
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No EMIs added. Skip if you have none.
        </div>
      ) : (
        list.map((emi) => (
          <div key={emi.id} className="rounded-xl border border-border bg-background p-3">
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
              <div>
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  className="mt-1 min-h-11"
                  placeholder="e.g. Car loan"
                  value={emi.label}
                  onChange={(e) => updateRow(emi.id, { label: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Monthly EMI (₹)</Label>
                <CurrencyInput
                  className="mt-1"
                  value={emi.amount}
                  onValueChange={(n) => updateRow(emi.id, { amount: n })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">EMI ends in</Label>
                <div className="mt-1">
                  <MonthYearPicker
                    value={emi.endDate}
                    onChange={(v) => updateRow(emi.id, { endDate: v })}
                    ariaLabel="EMI end date"
                  />
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  onClick={() => removeRow(emi.id)}
                  aria-label="Remove EMI"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {emi.endDate ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Ends {formatYearMonth(emi.endDate)} — surplus increases by{" "}
                {formatINR(emi.amount)} from then on.
              </p>
            ) : null}
          </div>
        ))
      )}
      <Button type="button" variant="outline" className="min-h-11" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add EMI
      </Button>
    </div>
  );
}
function Field({
  label,
  helper,
  children,
  className,
  ai = false,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  className?: string;
  ai?: boolean;
}) {
  return (
    <div
      className={cn("space-y-1.5 rounded-lg", ai && "border-l-4 border-l-primary pl-3", className)}
    >
      <Label className="inline-flex items-center gap-2 text-sm">
        {label}
        {ai ? <Badge variant="secondary">AI</Badge> : null}
      </Label>
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
