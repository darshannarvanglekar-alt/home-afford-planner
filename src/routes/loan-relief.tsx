import * as React from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CurrencyInput } from "@/components/plan/CurrencyInput";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/plan-schema";
import {
  buildMultiChartData,
  computeMultiPaymentRelief,
  formatYearsMonths,
  generatePartPaymentId,
  monthLabel,
  monthLabelFromOffset,
  type MultiPaymentInputs,
  type PartPayment,
  type PrepayMode,
} from "@/lib/loan-relief";
import {
  addScenario,
  buildSnapshot,
  listScenarios,
  MAX_SCENARIOS,
  takePendingLoad,
} from "@/lib/scenarios";
import {
  defaultFinances,
  defaultHome,
  defaultProfile,
  type CurrentInvestment,
} from "@/lib/plan-schema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loan-relief")({
  head: () => ({
    meta: [
      { title: "Loan Relief Planner — HomeAfford" },
      {
        name: "description",
        content:
          "See how part payments reduce your interest burden and close your loan faster.",
      },
      { property: "og:title", content: "Loan Relief Planner — HomeAfford" },
      {
        property: "og:description",
        content:
          "Illustrative scenarios for loan part payment impact — interest saved and time saved.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      corpusAmount: typeof search.corpusAmount === "number" ? search.corpusAmount : undefined,
      possessionMonth: typeof search.possessionMonth === "number" ? search.possessionMonth : undefined,
    } as { corpusAmount?: number; possessionMonth?: number };
  },
  component: LoanReliefPage,
});

function compactINR(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${Math.round(n)}`;
}

const MAX_PART_PAYMENTS = 10;

function createEmptyPartPayment(): PartPayment {
  return {
    id: generatePartPaymentId(),
    label: "",
    amount: 0,
    timing: "before_possession",
    month: 1,
    mode: "shorten_tenure",
  };
}

function LoanReliefPage() {
  const { user } = useAuth();
  const now = new Date();
  const search = Route.useSearch();

  const staged = React.useMemo(() => takePendingLoad(), []);
  const initialPrincipal = staged?.outputs?.loanAmount ?? 0;
  const initialRate = staged?.outputs?.interestRate ?? 8.5;
  const initialTenure = staged?.outputs?.tenureYears ?? 20;

  const [principal, setPrincipal] = React.useState<number>(initialPrincipal);
  const [rate, setRate] = React.useState<number>(initialRate);
  const [tenure, setTenure] = React.useState<number>(initialTenure);
  const [emiOverride, setEmiOverride] = React.useState<number>(0);
  const [emiTouched, setEmiTouched] = React.useState(false);
  const [startMonth, setStartMonth] = React.useState<number>(now.getMonth() + 1);
  const [startYear, setStartYear] = React.useState<number>(now.getFullYear());
  const [possessionMonth, setPossessionMonth] = React.useState<number>(
    search.possessionMonth ?? 36
  );

  // Part payments
  const [partPayments, setPartPayments] = React.useState<PartPayment[]>(() => {
    if (search.corpusAmount && search.corpusAmount > 0) {
      return [
        {
          id: generatePartPaymentId(),
          label: "Corpus at possession",
          amount: search.corpusAmount,
          timing: "before_possession",
          month: search.possessionMonth ?? 36,
          mode: "shorten_tenure",
        },
      ];
    }
    return [];
  });

  // Recurring extra
  const [extraMonthly, setExtraMonthly] = React.useState<number>(0);
  const [extraStartMonth, setExtraStartMonth] = React.useState<number>(1);
  const [stepUpEnabled, setStepUpEnabled] = React.useState<boolean>(false);
  const [stepUpPct, setStepUpPct] = React.useState<number>(10);
  const [showRecurring, setShowRecurring] = React.useState(false);

  const totalMonths = Math.max(12, Math.round(tenure * 12));

  const inputs: MultiPaymentInputs = {
    principal,
    annualRatePct: rate,
    tenureYears: tenure,
    emiOverride: emiTouched ? emiOverride : undefined,
    startYear,
    startMonth,
    possessionMonth,
    partPayments,
    extraMonthly,
    extraStartMonth,
    stepUpEnabled,
    stepUpPct,
    useRecurring: showRecurring && extraMonthly > 0,
  };

  const result = React.useMemo(() => computeMultiPaymentRelief(inputs), [
    principal, rate, tenure, emiOverride, emiTouched, startYear, startMonth,
    possessionMonth, partPayments, extraMonthly, extraStartMonth, stepUpEnabled,
    stepUpPct, showRecurring,
  ]);

  React.useEffect(() => {
    if (!emiTouched) setEmiOverride(Math.round(result.baseEmi));
  }, [result.baseEmi, emiTouched]);

  const chartData = React.useMemo(
    () => buildMultiChartData(result.baseline, result.withPayments, result.resolved, result.possessionMonth),
    [result],
  );

  const activePayments = partPayments.filter((p) => p.amount > 0);

  // AI nudge
  const [nudge, setNudge] = React.useState<string | null>(null);
  const nudgeTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!user) return;
    if (principal <= 0 || activePayments.length === 0) {
      setNudge(null);
      return;
    }
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const resp = await fetch("/api/generate-loan-relief-nudge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            principal,
            annualRatePct: rate,
            tenureYears: tenure,
            baseEmi: result.baseEmi,
            baselineTotalInterest: result.baseline.totalInterest,
            withPrepayTotalInterest: result.withPayments.totalInterest,
            interestSaved: result.interestSaved,
            monthsSaved: result.monthsSaved,
            partPayments: result.perPaymentImpact.map((p) => ({
              label: p.label,
              amount: p.amount,
              month: p.month,
              interestSaved: p.interestSaved,
              monthsSaved: p.monthsSaved,
            })),
            extraMonthly: showRecurring ? extraMonthly : 0,
            extraStartMonth: showRecurring ? extraStartMonth : 0,
            stepUpPct: stepUpEnabled ? stepUpPct : 0,
          }),
        });
        if (!resp.ok) { setNudge(null); return; }
        const data = (await resp.json()) as { nudge?: string };
        setNudge(data.nudge ?? null);
      } catch {
        setNudge(null);
      }
    }, 1200);
    return () => { if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current); };
  }, [user, principal, rate, tenure, activePayments.length, result.interestSaved, result.monthsSaved, result.baseEmi, showRecurring, extraMonthly]);

  const addPartPayment = () => {
    if (partPayments.length >= MAX_PART_PAYMENTS) {
      toast.error(`Maximum ${MAX_PART_PAYMENTS} part payments allowed.`);
      return;
    }
    setPartPayments([...partPayments, createEmptyPartPayment()]);
  };

  const removePartPayment = (id: string) => {
    setPartPayments(partPayments.filter((p) => p.id !== id));
  };

  const updatePartPayment = (id: string, patch: Partial<PartPayment>) => {
    setPartPayments(partPayments.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleSave = () => {
    const list = listScenarios(user?.id ?? null);
    if (list.length >= MAX_SCENARIOS) {
      toast.error(`You've reached the maximum of ${MAX_SCENARIOS} scenarios. Delete one to save a new scenario.`);
      return;
    }
    const home = {
      ...defaultHome,
      propertyCost: principal,
      downPayment: 0,
      interestRateA: rate,
      tenureYears: Math.round(tenure),
    };
    const investments: CurrentInvestment[] = [];
    const snap = buildSnapshot({
      name: `Loan relief — ${formatINR(principal)} @ ${rate}%`,
      finances: defaultFinances,
      investments,
      home,
      profile: defaultProfile,
      loanRelief: {
        onetimePrepayment: activePayments.reduce((s, p) => s + p.amount, 0),
        totalInterest: result.withPayments.totalInterest,
        interestSaved: result.interestSaved,
        closureMonthsFromNow: result.withPayments.monthsToClose,
        timeSavedMonths: result.monthsSaved,
      },
    });
    const res = addScenario(user?.id ?? null, snap);
    if (res.ok) toast.success("Scenario saved.");
    else toast.error("Could not save scenario.");
  };

  const handleDownload = () => {
    const ppLines = activePayments.length > 0
      ? [
          "Part payments:",
          ...result.perPaymentImpact.map(
            (p) => `  ${p.label}: ${formatINR(p.amount)} at month ${p.month} — saves ${formatINR(p.interestSaved)} interest, ${formatYearsMonths(p.monthsSaved)}`
          ),
          `  Total part payments: ${formatINR(activePayments.reduce((s, p) => s + p.amount, 0))}`,
        ]
      : ["Part payments: none"];

    const lines = [
      "HomeAfford — Loan Relief Scenario Summary",
      "(Illustrative scenario based on assumed rates)",
      "",
      "Loan details",
      `Principal: ${formatINR(principal)}`,
      `Annual rate: ${rate}%`,
      `Tenure: ${tenure} years`,
      `Monthly EMI: ${formatINR(result.baseEmi)}`,
      `Loan start: ${monthLabel(startYear, startMonth)}`,
      "",
      "Without part payments",
      `Total interest: ${formatINR(result.baseline.totalInterest)}`,
      `Total payable: ${formatINR(result.baseline.totalPaid)}`,
      `Loan closes: ${monthLabel(result.baseline.closureDate.year, result.baseline.closureDate.month)}`,
      "",
      ...ppLines,
      ...(showRecurring && extraMonthly > 0
        ? [`Extra monthly: ${formatINR(extraMonthly)} from month ${extraStartMonth}${stepUpEnabled ? `, +${stepUpPct}% per year` : ""}`]
        : []),
      "",
      "With part payments",
      `Total interest: ${formatINR(result.withPayments.totalInterest)}`,
      `Loan closes: ${monthLabel(result.withPayments.closureDate.year, result.withPayments.closureDate.month)}`,
      `Interest saved: ${formatINR(result.interestSaved)}`,
      `Time saved: ${formatYearsMonths(result.monthsSaved)}`,
      "",
      "HomeAfford is a scenario planning tool. All projections are illustrative and not financial, investment, or loan advice.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loan-relief-summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  const beforePossessionPayments = activePayments.filter((p) => p.timing === "before_possession");
  const beforePossessionTotal = beforePossessionPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <header className="mb-6">
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              Loan Relief Planner
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              See how part payments reduce your interest burden and close your loan faster.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              All numbers below are illustrative scenarios based on the rates and amounts you enter.
            </p>
          </header>

          {/* Section 1 — Loan details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Loan details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="principal">Original loan amount</Label>
                  <CurrencyInput
                    id="principal"
                    value={principal}
                    onValueChange={setPrincipal}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Annual interest rate (%)</Label>
                  <Input
                    id="rate"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={30}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Loan tenure</Label>
                  <span className="text-sm font-medium text-foreground">{tenure} years</span>
                </div>
                <Slider
                  min={5}
                  max={30}
                  step={1}
                  value={[tenure]}
                  onValueChange={(v) => setTenure(v[0] ?? tenure)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emi">Monthly EMI (auto, editable)</Label>
                  <CurrencyInput
                    id="emi"
                    value={emiTouched ? emiOverride : Math.round(result.baseEmi)}
                    onValueChange={(n) => {
                      setEmiTouched(true);
                      setEmiOverride(n);
                    }}
                    placeholder="0"
                  />
                  {emiTouched && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setEmiTouched(false)}
                    >
                      Reset to calculated EMI
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Loan start</Label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Start month"
                      className="h-11 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={startMonth}
                      onChange={(e) => setStartMonth(Number(e.target.value))}
                    >
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1, 1).toLocaleString("en-IN", { month: "long" })}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Start year"
                      className="h-11 w-28 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={startYear}
                      onChange={(e) => setStartYear(Number(e.target.value))}
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Possession / full disbursement month</Label>
                  <span className="text-sm font-medium text-foreground">
                    Month {possessionMonth} — {monthLabelFromOffset(startYear, startMonth, possessionMonth)}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={totalMonths}
                  step={1}
                  value={[possessionMonth]}
                  onValueChange={(v) => setPossessionMonth(v[0] ?? possessionMonth)}
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Without any part payments
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryRow label="Your monthly EMI" value={formatINR(result.baseEmi)} />
                  <SummaryRow label="Total amount payable" value={formatINR(result.baseline.totalPaid)} />
                  <SummaryRow label="Total interest payable" value={formatINR(result.baseline.totalInterest)} />
                  <SummaryRow
                    label="Loan closes in"
                    value={monthLabel(result.baseline.closureDate.year, result.baseline.closureDate.month)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 — Part Payment Planner */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Plan Your Part Payments</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Add one or more part payments at any point — before or after possession — and see how
                each one reduces your interest burden and closes your loan faster.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {partPayments.map((pp, idx) => (
                <PartPaymentRow
                  key={pp.id}
                  payment={pp}
                  index={idx}
                  onChange={(patch) => updatePartPayment(pp.id, patch)}
                  onRemove={() => removePartPayment(pp.id)}
                  totalMonths={totalMonths}
                  possessionMonth={possessionMonth}
                  startYear={startYear}
                  startMonth={startMonth}
                />
              ))}

              {partPayments.length < MAX_PART_PAYMENTS && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11"
                  onClick={addPartPayment}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another part payment
                </Button>
              )}

              {partPayments.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No part payments added yet. Tap the button above to simulate your first part payment.
                  </p>
                </div>
              )}

              {/* Before possession note */}
              {beforePossessionPayments.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    At possession your outstanding loan will be {formatINR(beforePossessionTotal)} lower.
                    {result.withPayments.points.length > 0 && (
                      <> Your full EMI after possession reduces to {formatINR(result.withPayments.points.at(-1)?.emi ?? result.baseEmi)}.</>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Making part payments during construction reduces your principal before full EMI
                    even begins — this is one of the most effective ways to reduce total interest.
                  </p>
                </div>
              )}

              {/* Recurring extra section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Also add regular extra monthly payments?</Label>
                  <Switch checked={showRecurring} onCheckedChange={setShowRecurring} />
                </div>
                {showRecurring && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Extra amount per month above regular EMI</Label>
                      <CurrencyInput value={extraMonthly} onValueChange={setExtraMonthly} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Starting from which month?</Label>
                        <span className="text-sm font-medium text-foreground">
                          Month {extraStartMonth} — {monthLabelFromOffset(startYear, startMonth, extraStartMonth)}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={totalMonths}
                        step={1}
                        value={[extraStartMonth]}
                        onValueChange={(v) => setExtraStartMonth(v[0] ?? extraStartMonth)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <Label htmlFor="stepup" className="text-sm">Annual step-up on extra payment</Label>
                        <p className="text-xs text-muted-foreground">Increase extra payment every year</p>
                      </div>
                      <Switch id="stepup" checked={stepUpEnabled} onCheckedChange={setStepUpEnabled} />
                    </div>
                    {stepUpEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Increase extra payment by</Label>
                          <span className="text-sm font-medium text-foreground">{stepUpPct}% / year</span>
                        </div>
                        <Slider min={5} max={20} step={1} value={[stepUpPct]} onValueChange={(v) => setStepUpPct(v[0] ?? stepUpPct)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 4 — Combined Impact Output */}
          <div className="sticky top-20 z-10 mb-6">
            <Card className="shadow-lg">
              <CardContent className="py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Without any part payments
                    </p>
                    <div className="space-y-2">
                      <SummaryRow label="Total interest" value={formatINR(result.baseline.totalInterest)} />
                      <SummaryRow label="Loan closes" value={monthLabel(result.baseline.closureDate.year, result.baseline.closureDate.month)} />
                      <SummaryRow label="Monthly EMI" value={formatINR(result.baseEmi)} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      With your planned part payments
                    </p>
                    <div className="space-y-2">
                      <HighlightRow label="Total interest" value={formatINR(result.withPayments.totalInterest)} highlight={result.interestSaved > 0} />
                      <HighlightRow label="Interest saved" value={formatINR(result.interestSaved)} highlight bold />
                      <HighlightRow
                        label="Loan closes"
                        value={monthLabel(result.withPayments.closureDate.year, result.withPayments.closureDate.month)}
                        highlight={result.monthsSaved > 0}
                      />
                      <HighlightRow label="Time saved" value={formatYearsMonths(result.monthsSaved)} highlight bold />
                      <HighlightRow
                        label="EMI after payments"
                        value={formatINR(result.withPayments.points.at(-1)?.emi ?? result.baseEmi)}
                        highlight={result.hasReduceEmi}
                      />
                    </div>
                  </div>
                </div>

                {activePayments.length > 0 && (result.interestSaved > 0 || result.monthsSaved > 0) && (
                  <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 p-4 text-center">
                    <p className="text-base font-semibold text-foreground sm:text-lg">
                      Your {activePayments.length} planned part payment{activePayments.length > 1 ? "s" : ""} save{" "}
                      <span className="text-success font-extrabold">{formatINR(result.interestSaved)}</span> in
                      interest and close your loan{" "}
                      <span className="text-success font-extrabold">{formatYearsMonths(result.monthsSaved)}</span>{" "}
                      earlier.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Illustrative scenario based on the rates you entered.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section 5 — Multi-line chart */}
          {principal > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Your loan balance over time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 sm:h-80 rounded-2xl border border-border bg-background p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v) => `${v}m`}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      />
                      <YAxis
                        tickFormatter={(v) => compactINR(Number(v))}
                        width={56}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatINR(value), name]}
                        labelFormatter={(label) => `Month ${label}`}
                        contentStyle={{
                          background: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {/* Possession line */}
                      <ReferenceLine
                        x={possessionMonth}
                        stroke="var(--color-muted-foreground)"
                        strokeDasharray="4 4"
                        label={{ value: "Possession", position: "top", fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      />
                      {/* Baseline */}
                      <Line
                        type="monotone"
                        dataKey="without"
                        name="No part payments"
                        stroke="var(--color-muted-foreground)"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                      />
                      {/* With payments */}
                      <Line
                        type="monotone"
                        dataKey="withPayments"
                        name="With part payments"
                        stroke="var(--color-chart-1)"
                        strokeWidth={3}
                        dot={(props: Record<string, unknown>) => {
                          const { cx, cy, payload } = props as { cx: number; cy: number; payload: { paymentEvent?: { label: string } } };
                          if (payload?.paymentEvent) {
                            return (
                              <circle
                                key={`dot-${cx}`}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="var(--color-chart-1)"
                                stroke="var(--color-background)"
                                strokeWidth={2}
                              />
                            );
                          }
                          return <circle key={`dot-${cx}`} cx={0} cy={0} r={0} fill="none" />;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {result.withPayments.monthsToClose < result.baseline.monthsToClose && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Loan fully paid — {monthLabel(result.withPayments.closureDate.year, result.withPayments.closureDate.month)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 6 — Per payment breakdown */}
          {result.perPaymentImpact.length > 0 && (
            <Card className="mb-6">
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">See impact of each payment individually</CardTitle>
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 pr-4 font-semibold text-muted-foreground">Payment</th>
                            <th className="pb-2 pr-4 font-semibold text-muted-foreground">Month</th>
                            <th className="pb-2 pr-4 font-semibold text-muted-foreground">Amount</th>
                            <th className="pb-2 pr-4 font-semibold text-muted-foreground">Interest saved</th>
                            <th className="pb-2 font-semibold text-muted-foreground">Months saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.perPaymentImpact.map((p) => (
                            <tr key={p.id} className="border-b border-border/50">
                              <td className="py-2 pr-4 font-medium text-foreground">{p.label}</td>
                              <td className="py-2 pr-4 text-muted-foreground">{p.month}</td>
                              <td className="py-2 pr-4 font-medium text-foreground">{formatINR(p.amount)}</td>
                              <td className="py-2 pr-4 font-semibold text-success">{formatINR(p.interestSaved)}</td>
                              <td className="py-2 font-semibold text-success">{formatYearsMonths(p.monthsSaved)}</td>
                            </tr>
                          ))}
                          {result.perPaymentImpact.length > 1 && (
                            <tr className="font-extrabold">
                              <td className="py-2 pr-4 text-foreground">Total (combined)</td>
                              <td className="py-2 pr-4" />
                              <td className="py-2 pr-4 text-foreground">
                                {formatINR(result.perPaymentImpact.reduce((s, p) => s + p.amount, 0))}
                              </td>
                              <td className="py-2 pr-4 text-success">{formatINR(result.interestSaved)}</td>
                              <td className="py-2 text-success">{formatYearsMonths(result.monthsSaved)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Earlier payments always save more interest than later ones of the same amount.
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Section 7 — AI nudge */}
          {nudge && (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <p className="text-sm leading-relaxed text-foreground">{nudge}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Illustrative observation based on assumed rates.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section 9 — Save / Download */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave} className="min-h-11 sm:flex-1">
              Save this scenario
            </Button>
            <Button onClick={handleDownload} variant="outline" className="min-h-11 sm:flex-1">
              Download summary
            </Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            HomeAfford is a scenario planning tool. All projections are illustrative and not
            financial, investment, or loan advice.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function HighlightRow({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          highlight ? "text-success" : "text-foreground",
          bold && "font-extrabold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PartPaymentRow({
  payment,
  index,
  onChange,
  onRemove,
  totalMonths,
  possessionMonth,
  startYear,
  startMonth,
}: {
  payment: PartPayment;
  index: number;
  onChange: (patch: Partial<PartPayment>) => void;
  onRemove: () => void;
  totalMonths: number;
  possessionMonth: number;
  startYear: number;
  startMonth: number;
}) {
  const maxMonth =
    payment.timing === "before_possession"
      ? Math.max(1, possessionMonth)
      : Math.max(1, totalMonths - possessionMonth);

  const displayMonth =
    payment.timing === "before_possession"
      ? monthLabelFromOffset(startYear, startMonth, payment.month)
      : monthLabelFromOffset(startYear, startMonth, possessionMonth + payment.month);

  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Part payment {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove this part payment"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment label</Label>
          <Input
            type="text"
            value={payment.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder='e.g. "Bonus", "Matured FD", "Corpus at possession"'
          />
        </div>
        <div className="space-y-2">
          <Label>Payment amount (₹)</Label>
          <CurrencyInput
            value={payment.amount}
            onValueChange={(n) => onChange({ amount: n })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Payment timing</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={payment.timing === "before_possession" ? "default" : "outline"}
            className="min-h-11 text-xs sm:text-sm"
            onClick={() => onChange({ timing: "before_possession", month: 1 })}
          >
            Before possession
          </Button>
          <Button
            type="button"
            variant={payment.timing === "after_possession" ? "default" : "outline"}
            className="min-h-11 text-xs sm:text-sm"
            onClick={() => onChange({ timing: "after_possession", month: 1 })}
          >
            After possession
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            {payment.timing === "before_possession"
              ? `Month ${payment.month}`
              : `Month ${payment.month} after possession`}
          </Label>
          <span className="text-sm font-medium text-foreground">{displayMonth}</span>
        </div>
        <Slider
          min={1}
          max={maxMonth}
          step={1}
          value={[Math.min(payment.month, maxMonth)]}
          onValueChange={(v) => onChange({ month: v[0] ?? 1 })}
        />
      </div>

      <div className="space-y-2">
        <Label>After this payment, I prefer:</Label>
        <RadioGroup
          value={payment.mode}
          onValueChange={(v) => onChange({ mode: v as PrepayMode })}
          className="gap-3"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="reduce_emi" id={`reduce-${payment.id}`} className="mt-1" />
            <Label htmlFor={`reduce-${payment.id}`} className="text-sm font-normal">
              Reduce my EMI (same tenure, lower monthly payment)
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="shorten_tenure" id={`shorten-${payment.id}`} className="mt-1" />
            <Label htmlFor={`shorten-${payment.id}`} className="text-sm font-normal">
              Close loan faster (same EMI, shorter tenure)
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export default LoanReliefPage;
