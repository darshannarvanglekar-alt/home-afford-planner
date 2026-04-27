import * as React from "react";
import { Loader2, Upload, X } from "lucide-react";
import { CurrencyInput } from "./CurrencyInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { proBadgeText } from "@/lib/subscription";
import {
  type Finances,
  formatINR,
  surplus,
  totalIncome,
  totalOutflow,
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
  { key: "housing", emoji: "🏠", label: "Housing & Utilities", helper: "rent, electricity, water, maintenance" },
  { key: "family", emoji: "👨‍👩‍👧", label: "Family & Dependents", helper: "school fees, childcare, elderly care" },
  { key: "health", emoji: "🏥", label: "Health & Protection", helper: "medical, health, term + car insurance" },
  { key: "daily", emoji: "🛒", label: "Daily Living", helper: "groceries, food, fuel, transport" },
  { key: "investments", emoji: "📈", label: "Investments & Savings", helper: "SIPs, FDs, RDs, PPF (monthly)" },
  { key: "discretionary", emoji: "🎉", label: "Discretionary", helper: "dining, travel, entertainment, shopping" },
];

export function Step1Finances({ value, onChange, canUseProFeatures = true, onUpgradeRequired }: Props) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [analysing, setAnalysing] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [aiFields, setAiFields] = React.useState<Set<string>>(new Set());
  const inputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof Finances>(section: K, patch: Partial<Finances[K]>) => {
    onChange({ ...value, [section]: { ...value[section], ...patch } });
  };

  const validateAndAddFiles = (incoming: FileList | File[]) => {
    if (!canUseProFeatures) {
      onUpgradeRequired?.("AI statement analysis is a Pro feature. Upgrade to unlock instant auto-fill.");
      return;
    }
    setMessage(null);
    const selected = Array.from(incoming);
    const valid: File[] = [];
    for (const file of selected) {
      const ok = file.type === "application/pdf" || file.type.includes("csv") || /\.(pdf|csv)$/i.test(file.name);
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
        emis: Math.round(extracted.existingEMIs),
        insurance: Math.round(extracted.insurancePremiums),
      },
      expenses: {
        housing: Math.round(extracted.housingUtilities),
        family: Math.round(extracted.familyDependents),
        health: Math.round(extracted.healthProtection),
        daily: Math.round(extracted.dailyLiving),
        investments: Math.round(extracted.investmentsSavings),
        discretionary: Math.round(extracted.discretionary),
      },
    });
    setAiFields(new Set([
      "income.primarySalary",
      "income.additionalIncome",
      "income.familyContribution",
      "commitments.emis",
      "commitments.insurance",
      "expenses.housing",
      "expenses.family",
      "expenses.health",
      "expenses.daily",
      "expenses.investments",
      "expenses.discretionary",
    ]));
    setMessage({
      type: "success",
      text: `✅ AI has filled in your details from ${months} months of statements. Please review and edit anything that looks wrong. ✅ File deleted from our servers after analysis.`,
    });
  };

  const handleAnalyze = async () => {
    if (!canUseProFeatures) {
      onUpgradeRequired?.("AI statement analysis is a Pro feature. Upgrade to unlock instant auto-fill.");
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
      const data = await res.json() as { values?: ExtractedStatementValues; months?: number; error?: string };
      if (!res.ok || !data.values) throw new Error(data.error || "We couldn't read this file automatically. Please fill in the details below manually.");
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
  const outflow = totalOutflow(value);
  const net = surplus(value);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Let AI fill this for you</h2>
            <Badge variant="secondary">{proBadgeText()}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Upload your last 3-6 months of bank statements. Our AI will auto-detect your income, expenses, EMIs and investments.
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
            📄 Drop your bank statement here or click to upload
          </span>
          <span className="mt-1 text-xs text-muted-foreground">PDF or CSV · up to 6 files · 10MB each</span>
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
          🔒 Your files are analysed instantly and permanently deleted. We never store your bank statements.
        </p>
        {message && (
          <div className={cn(
            "mt-4 rounded-xl border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-success/25 bg-success-soft text-success-soft-foreground"
              : "border-destructive/25 bg-danger-soft text-danger-soft-foreground",
          )}>
            {message.text}
          </div>
        )}
        <Button className="mt-5 w-full sm:w-auto" onClick={handleAnalyze} disabled={files.length === 0 || analysing}>
          {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : "✨"}
          {analysing ? "AI is reading your statement..." : "Analyse with AI"}
        </Button>
        {analysing && <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary" /></div>}
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
          <Field label="Family Contribution" className="sm:col-span-2" ai={aiFields.has("income.familyContribution")}>
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
            ai={aiFields.has("commitments.emis")}
          >
            <CurrencyInput
              value={value.commitments.emis}
              onValueChange={(n) => set("commitments", { emis: n })}
            />
          </Field>
          <Field label="Insurance premiums total / month" ai={aiFields.has("commitments.insurance")}>
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
                    {aiFields.has(`expenses.${c.key}`) ? <Badge variant="secondary">AI</Badge> : null}
                  </div>
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
      className={cn(
        "space-y-1.5 rounded-lg",
        ai && "border-l-4 border-l-primary pl-3",
        className,
      )}
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
