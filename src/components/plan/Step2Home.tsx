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
import { proBadgeText } from "@/lib/subscription";
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
  canUseProFeatures?: boolean;
  onUpgradeRequired?: (message: string) => void;
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

export function Step2Home({ value, onChange, canUseProFeatures = true, onUpgradeRequired }: Props) {
  const [scheduleFile, setScheduleFile] = React.useState<File | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [extractMessage, setExtractMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [aiStageIds, setAiStageIds] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

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

  const validateScheduleFile = (file: File) => {
    const ok = file.type === "application/pdf" || file.type === "image/jpeg" || file.type === "image/png" || /\.(pdf|jpg|jpeg|png)$/i.test(file.name);
    if (!ok) {
      setExtractMessage({ type: "error", text: "Please upload a PDF, JPG or PNG file only." });
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractMessage({ type: "error", text: "File too large. Please upload under 10MB or take a photo instead." });
      return false;
    }
    return true;
  };

  const chooseScheduleFile = (file?: File) => {
    if (!file) return;
    if (!canUseProFeatures) {
      onUpgradeRequired?.("AI document extraction is a Pro feature. Upgrade to unlock.");
      return;
    }
    setExtractMessage(null);
    if (validateScheduleFile(file)) setScheduleFile(file);
  };

  const extractPaymentPlan = async () => {
    if (!canUseProFeatures) {
      onUpgradeRequired?.("AI document extraction is a Pro feature. Upgrade to unlock.");
      return;
    }
    if (!scheduleFile) return;
    setExtracting(true);
    setExtractMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in before extracting a payment plan.");

      const form = new FormData();
      form.append("file", scheduleFile);
      form.append("propertyCost", String(value.propertyCost || 0));

      const res = await fetch("/api/extract-builder-payment-plan", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json() as { stages?: ExtractedStage[]; propertyCost?: number; error?: string };
      if (!res.ok || !data.stages?.length) {
        throw new Error(data.error || "We couldn't find a payment schedule in this document. Please enter the stages manually below.");
      }

      const stages = data.stages.map((stage, index) => ({
        id: `ai-${Date.now()}-${index}`,
        name: stage.stageName || `Stage ${index + 1}`,
        month: Math.max(1, Math.round(stage.month || index + 1)),
        bankPays: Math.round(stage.bankAmount || 0),
        youPay: Math.round(stage.selfAmount || Math.max(0, (stage.totalAmount || 0) - (stage.bankAmount || 0))),
      }));
      onChange({
        ...value,
        propertyCost: value.propertyCost || Math.round(data.propertyCost || 0),
        builderStages: stages,
      });
      setAiStageIds(new Set(stages.map((s) => s.id)));
      setExtractMessage({
        type: "success",
        text: `✅ Found ${stages.length} payment stages. Please review and edit if anything looks wrong. ✅ Document deleted after analysis.`,
      });
      setScheduleFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } catch (error) {
      setExtractMessage({
        type: "error",
        text: error instanceof Error ? error.message : "The image quality is too low to read. Please try a clearer photo or upload the PDF directly.",
      });
    } finally {
      setExtracting(false);
    }
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

          <div className="rounded-2xl border border-border bg-background p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">Upload your builder payment schedule</h3>
              <Badge variant="secondary">{proBadgeText()}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Have a payment plan PDF or image from your builder? Upload it and AI will fill the stage table automatically.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => chooseScheduleFile(e.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => chooseScheduleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                chooseScheduleFile(e.dataTransfer.files?.[0]);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/35 px-4 py-8 text-center transition hover:border-primary/50 hover:bg-primary-soft/40"
            >
              <Upload className="h-8 w-8 text-primary" />
              <span className="mt-3 text-sm font-semibold text-foreground">
                📄 Drop builder payment schedule here or click to upload
              </span>
              <span className="mt-1 text-xs text-muted-foreground">PDF, JPG or PNG · under 10MB</span>
            </button>
            <div className="mt-3 grid gap-2 sm:hidden">
              <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="h-4 w-4" />
                Take a Photo
              </Button>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-4 w-4" />
                Choose File
              </Button>
              <p className="text-xs text-muted-foreground">
                Tip: Take a clear, well-lit photo of the full payment schedule page for best results.
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Supports builder allotment letters, payment schedules, and demand letters.
            </p>
            {scheduleFile && (
              <Badge variant="outline" className="mt-3 gap-1.5 py-1">
                {scheduleFile.name}
                <button type="button" onClick={() => setScheduleFile(null)} aria-label="Remove schedule file">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {extractMessage && (
              <div
                className={cn(
                  "mt-4 rounded-xl border px-4 py-3 text-sm",
                  extractMessage.type === "success"
                    ? "border-success/25 bg-success-soft text-success-soft-foreground"
                    : "border-destructive/25 bg-danger-soft text-danger-soft-foreground",
                )}
              >
                {extractMessage.text}
              </div>
            )}
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              disabled={!scheduleFile || extracting}
              onClick={extractPaymentPlan}
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : "✨"}
              Extract Payment Plan
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or enter stages manually below</span>
            <span className="h-px flex-1 bg-border" />
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
                      <tr
                        key={s.id}
                        className={cn(
                          "border-b border-border/60 align-top",
                          aiStageIds.has(s.id) && "border-l-4 border-l-primary bg-primary/5",
                        )}
                      >
                        <td className="py-2 pr-3">
                          {aiStageIds.has(s.id) && <Badge variant="secondary" className="mb-1">AI</Badge>}
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
