import * as React from "react";
import { Minus, Plus, AlertTriangle, Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "./CurrencyInput";
import { cn } from "@/lib/utils";
import {
  type Profile,
  type EmergencyFundPref,
  type EmploymentType,
  type IncomeStability,
  recommendEmergencyFund,
} from "@/lib/plan-schema";

interface Props {
  value: Profile;
  onChange: (next: Profile) => void;
}

const FUND_OPTIONS: Array<{
  key: EmergencyFundPref;
  emoji: string;
  title: string;
  desc: string;
}> = [
  {
    key: "conservative",
    emoji: "🛡️",
    title: "Conservative",
    desc: "Keep 6 months of essential expenses always available. Maximum safety. Recommended if you have dependents or elderly parents.",
  },
  {
    key: "balanced",
    emoji: "⚖️",
    title: "Balanced",
    desc: "Keep 4 months of essential expenses available. Good balance of safety and growth.",
  },
  {
    key: "aggressive",
    emoji: "🚀",
    title: "Aggressive",
    desc: "Keep 2 months of essential expenses available. More money free for investments. Only if you have strong job security and no major dependents.",
  },
];

const EMPLOYMENT_OPTIONS: Array<{ key: EmploymentType; emoji: string; label: string }> = [
  { key: "salaried_private", emoji: "🏢", label: "Salaried (Private)" },
  { key: "salaried_government", emoji: "🏛️", label: "Salaried (Government)" },
  { key: "self_employed", emoji: "💼", label: "Self Employed" },
  { key: "freelance", emoji: "🌐", label: "Freelance / Gig" },
];

const STABILITY_OPTIONS: Array<{ key: IncomeStability; emoji: string; label: string }> = [
  { key: "very_stable", emoji: "✅", label: "Very stable — consistent every month" },
  { key: "mostly_stable", emoji: "📊", label: "Mostly stable — occasional variation" },
  { key: "variable", emoji: "📉", label: "Variable — changes significantly month to month" },
];

const UPCOMING_MONTHS = Array.from({ length: 24 }, (_, i) => i + 1);

export function Step3Profile({ value, onChange }: Props) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    onChange({ ...value, [k]: v });

  const recommendation = recommendEmergencyFund(value);
  const recLabel = recommendation === "conservative" ? "CONSERVATIVE" : "BALANCED";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Tell us about your family situation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          This helps us set the right emergency fund and give you accurate suggestions.
        </p>
      </div>

      {/* Family */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Your Family</h2>

        <div className="mt-5 space-y-5">
          <div>
            <Label className="text-sm font-medium">Number of dependents</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Children, parents or others who depend on your income
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled={value.dependents <= 0}
                onClick={() => set("dependents", Math.max(0, value.dependents - 1))}
                aria-label="Decrease dependents"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="min-w-[3.5rem] text-center text-lg font-semibold tabular-nums text-foreground">
                {value.dependents === 6 ? "6+" : value.dependents}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled={value.dependents >= 6}
                onClick={() => set("dependents", Math.min(6, value.dependents + 1))}
                aria-label="Increase dependents"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ToggleRow
            label="Elderly parents dependent on you"
            helper="Parents who rely on you for regular financial support"
            checked={value.elderlyParents}
            onChange={(v) => set("elderlyParents", v)}
          />

          <ToggleRow
            label="Are you the sole earner?"
            checked={value.soleEarner}
            onChange={(v) => set("soleEarner", v)}
          />
        </div>
      </section>

      {/* Protection */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Financial Protection</h2>

        <div className="mt-5 space-y-5">
          <div>
            <ToggleRow
              label="Health insurance available"
              checked={value.healthInsurance}
              onChange={(v) => set("healthInsurance", v)}
            />
            {!value.healthInsurance && (
              <WarningCard
                tone="amber"
                icon={<AlertTriangle className="h-4 w-4" />}
                text="No health insurance detected. A medical emergency without cover can severely impact your home loan plan. We strongly recommend getting health insurance before committing to a home loan."
              />
            )}
          </div>

          <div>
            <ToggleRow
              label="Term life insurance"
              checked={value.termInsurance}
              onChange={(v) => set("termInsurance", v)}
            />
            {!value.termInsurance && (
              <WarningCard
                tone="amber"
                icon={<Lightbulb className="h-4 w-4" />}
                text="Term insurance is recommended when taking a large home loan. It protects your family if something happens to you."
              />
            )}
          </div>

          <div>
            <ToggleRow
              label="Any known large upcoming expense?"
              checked={value.hasUpcomingExpense}
              onChange={(v) => set("hasUpcomingExpense", v)}
            />
            {value.hasUpcomingExpense && (
              <div className="mt-4 grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="upcoming-amount" className="text-sm">
                    Estimated amount (₹)
                  </Label>
                  <CurrencyInput
                    id="upcoming-amount"
                    value={value.upcomingExpenseAmount}
                    onValueChange={(v) => set("upcomingExpenseAmount", v)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm">Expected in month</Label>
                  <Select
                    value={String(value.upcomingExpenseMonth)}
                    onValueChange={(v) => set("upcomingExpenseMonth", Number(v))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UPCOMING_MONTHS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          Month {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Emergency Fund */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Emergency Fund Preference</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How much safety buffer do you want to maintain at all times?
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {FUND_OPTIONS.map((opt) => {
            const selected = value.emergencyFundPref === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => set("emergencyFundPref", opt.key)}
                className={cn(
                  "flex flex-col rounded-xl border-2 p-4 text-left transition",
                  "hover:border-primary/50",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="mt-2 text-base font-semibold text-foreground">
                  {opt.title}
                </span>
                <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Based on your profile, we recommend:{" "}
            <span className="font-semibold text-primary">{recLabel}</span>
          </span>
        </div>
      </section>

      {/* Income Stability */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Job & Income Stability</h2>

        <div className="mt-5 space-y-6">
          <div>
            <Label className="text-sm font-medium">Employment type</Label>
            <RadioGroup
              value={value.employmentType}
              onValueChange={(v) => set("employmentType", v as EmploymentType)}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.key}
                  id={`emp-${opt.key}`}
                  value={opt.key}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={value.employmentType === opt.key}
                />
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium">How stable is your income?</Label>
            <RadioGroup
              value={value.incomeStability}
              onValueChange={(v) => set("incomeStability", v as IncomeStability)}
              className="mt-3 grid gap-2"
            >
              {STABILITY_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.key}
                  id={`stab-${opt.key}`}
                  value={opt.key}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={value.incomeStability === opt.key}
                />
              ))}
            </RadioGroup>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function WarningCard({
  icon,
  text,
}: {
  tone: "amber";
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-foreground">
      <span className="mt-0.5 shrink-0 text-warning">{icon}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}

function RadioCard({
  id,
  value,
  emoji,
  label,
  selected,
}: {
  id: string;
  value: string;
  emoji: string;
  label: string;
  selected: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition",
        "hover:border-primary/50",
        selected ? "border-primary bg-primary/5" : "border-border bg-background",
      )}
    >
      <RadioGroupItem id={id} value={value} />
      <span className="text-lg">{emoji}</span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );
}
