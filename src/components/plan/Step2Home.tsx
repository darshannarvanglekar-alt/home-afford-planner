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
import { cn } from "@/lib/utils";
import {
  type Home,
  type PropertyType,
  formatINR,
} from "@/lib/plan-schema";

interface Props {
  value: Home;
  onChange: (next: Home) => void;
  canUseProFeatures?: boolean;
  onUpgradeRequired?: (message: string) => void;
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

const POSSESSION_MONTHS = Array.from({ length: 60 }, (_, i) => i + 1);

export function Step2Home({ value, onChange }: Props) {
  const set = <K extends keyof Home>(k: K, v: Home[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Tell us about the home you want to buy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the details of the property. Loan details come in the next step.
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
            <Label htmlFor="propertyCost">Total property value (₹)</Label>
            <CurrencyInput
              id="propertyCost"
              value={value.propertyCost}
              onValueChange={(n) => set("propertyCost", n)}
              placeholder="0"
            />
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="builderName">Builder or project name (optional)</Label>
            <Input
              id="builderName"
              value={value.builderName || ""}
              onChange={(e) => set("builderName", e.target.value)}
              placeholder="e.g., Prestige Lakeside"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          You'll set down payment, interest rate, and tenure in the next step.
        </p>
      </section>

      {/* Conditional: under construction */}
      {value.propertyType === "construction" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Construction Details</h2>

          {/* Possession month */}
          <div className="space-y-1.5">
            <Label htmlFor="possession">
              When do you expect to get possession?
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

          {/* Disbursement stages */}
          <div className="space-y-2">
            <Label>How many disbursement stages does your builder have?</Label>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("disbursementStages", n)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors",
                    (value.disbursementStages || 3) === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              We assume equal disbursement across stages. This gives a close approximation for planning purposes.
            </p>
          </div>
        </section>
      )}

      {/* Conditional: ready to move — one-time costs */}
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

      {/* Possession for non-construction (ready/plot) */}
      {value.propertyType !== "construction" && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="space-y-1.5">
            <Label htmlFor="possessionReady">
              When do you expect to move in or complete purchase?
            </Label>
            <Select
              value={String(value.possessionMonth)}
              onValueChange={(v) => set("possessionMonth", Number.parseInt(v, 10))}
            >
              <SelectTrigger id="possessionReady" className="sm:max-w-xs">
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
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        HomeAfford is a scenario planning tool. All projections are illustrative and not financial,
        investment, or loan advice.
      </p>
    </div>
  );
}
