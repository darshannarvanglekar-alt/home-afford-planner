import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/plan-schema";
import {
  buildChartData,
  computeRelief,
  formatYearsMonths,
  monthLabel,
  type LoanReliefInputs,
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

export const Route = createFileRoute("/loan-relief")({
  head: () => ({
    meta: [
      { title: "Loan Relief Planner — HomeAfford" },
      {
        name: "description",
        content:
          "See how prepayments and extra contributions reduce your interest burden and close your loan faster.",
      },
      { property: "og:title", content: "Loan Relief Planner — HomeAfford" },
      {
        property: "og:description",
        content:
          "Illustrative scenarios for loan prepayment impact — interest saved and time saved.",
      },
    ],
  }),
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

function LoanReliefPage() {
  const { user } = useAuth();
  const now = new Date();

  // Try to pre-fill from a staged scenario load
  const staged = React.useMemo(() => takePendingLoad(), []);
  const initialPrincipal = staged?.outputs?.loanAmount ?? 0;
  const initialRate = staged?.outputs?.interestRate ?? 8.5;
  const initialTenure = staged?.outputs?.tenureYears ?? 20;
  const initialCorpus = staged?.outputs?.projectedCorpus ?? 0;

  // Inputs
  const [principal, setPrincipal] = React.useState<number>(initialPrincipal);
  const [rate, setRate] = React.useState<number>(initialRate);
  const [tenure, setTenure] = React.useState<number>(initialTenure);
  const [emiOverride, setEmiOverride] = React.useState<number>(0);
  const [emiTouched, setEmiTouched] = React.useState(false);
  const [startMonth, setStartMonth] = React.useState<number>(now.getMonth() + 1);
  const [startYear, setStartYear] = React.useState<number>(now.getFullYear());

  // Tabs / mode
  const [tab, setTab] = React.useState<"onetime" | "recurring">("onetime");
  const [combine, setCombine] = React.useState(false);

  // One-time
  const [oneTimeAmount, setOneTimeAmount] = React.useState<number>(0);
  const [oneTimeAtMonth, setOneTimeAtMonth] = React.useState<number>(12);
  const [oneTimeMode, setOneTimeMode] = React.useState<PrepayMode>("shorten_tenure");

  // Recurring
  const [extraMonthly, setExtraMonthly] = React.useState<number>(0);
  const [extraStartMonth, setExtraStartMonth] = React.useState<number>(1);
  const [stepUpEnabled, setStepUpEnabled] = React.useState<boolean>(false);
  const [stepUpPct, setStepUpPct] = React.useState<number>(10);

  // Corpus connector
  const [corpusAvailable, setCorpusAvailable] = React.useState<number>(initialCorpus);
  const [corpusUsedPct, setCorpusUsedPct] = React.useState<number>(50);

  const useOneTime = tab === "onetime" || combine;
  const useRecurring = tab === "recurring" || combine;

  const totalMonths = Math.max(12, Math.round(tenure * 12));

  // Clamp month sliders if tenure shrinks
  React.useEffect(() => {
    if (oneTimeAtMonth > totalMonths) setOneTimeAtMonth(totalMonths);
    if (extraStartMonth > totalMonths) setExtraStartMonth(totalMonths);
  }, [totalMonths, oneTimeAtMonth, extraStartMonth]);

  const inputs: LoanReliefInputs = {
    principal,
    annualRatePct: rate,
    tenureYears: tenure,
    emiOverride: emiTouched ? emiOverride : undefined,
    startYear,
    startMonth,
    oneTimeAmount,
    oneTimeAtMonth,
    oneTimeMode,
    extraMonthly,
    extraStartMonth,
    stepUpEnabled,
    stepUpPct,
    useOneTime,
    useRecurring,
  };

  const result = React.useMemo(() => computeRelief(inputs), [
    principal,
    rate,
    tenure,
    emiOverride,
    emiTouched,
    startYear,
    startMonth,
    oneTimeAmount,
    oneTimeAtMonth,
    oneTimeMode,
    extraMonthly,
    extraStartMonth,
    stepUpEnabled,
    stepUpPct,
    useOneTime,
    useRecurring,
  ]);

  // Sync EMI display when not overridden
  React.useEffect(() => {
    if (!emiTouched) setEmiOverride(Math.round(result.baseEmi));
  }, [result.baseEmi, emiTouched]);

  const chartData = React.useMemo(
    () => buildChartData(result.baseline, result.withPrepay),
    [result],
  );

  // Corpus connector — recompute with corpus prepay applied as additional one-time at month 1
  const corpusUsedAmount = Math.round((corpusAvailable * corpusUsedPct) / 100);
  const corpusInputs: LoanReliefInputs = {
    ...inputs,
    useOneTime: true,
    oneTimeAmount: (useOneTime ? oneTimeAmount : 0) + corpusUsedAmount,
    oneTimeAtMonth: useOneTime ? oneTimeAtMonth : 1,
    oneTimeMode: oneTimeMode,
  };
  const corpusResult = React.useMemo(() => computeRelief(corpusInputs), [
    principal,
    rate,
    tenure,
    emiOverride,
    emiTouched,
    startYear,
    startMonth,
    oneTimeAmount,
    oneTimeAtMonth,
    oneTimeMode,
    extraMonthly,
    extraStartMonth,
    stepUpEnabled,
    stepUpPct,
    useOneTime,
    useRecurring,
    corpusUsedAmount,
  ]);

  // AI nudge
  const [nudge, setNudge] = React.useState<string | null>(null);
  const nudgeTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!user) return; // requires auth
    if (principal <= 0 || (oneTimeAmount <= 0 && extraMonthly <= 0)) {
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
            withPrepayTotalInterest: result.withPrepay.totalInterest,
            interestSaved: result.interestSaved,
            monthsSaved: result.monthsSaved,
            oneTimeAmount: useOneTime ? oneTimeAmount : 0,
            oneTimeAtMonth: useOneTime ? oneTimeAtMonth : 0,
            extraMonthly: useRecurring ? extraMonthly : 0,
            extraStartMonth: useRecurring ? extraStartMonth : 0,
            stepUpPct: stepUpEnabled ? stepUpPct : 0,
          }),
        });
        if (!resp.ok) {
          setNudge(null);
          return;
        }
        const data = (await resp.json()) as { nudge?: string };
        setNudge(data.nudge ?? null);
      } catch {
        setNudge(null);
      }
    }, 1200);
    return () => {
      if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
    };
  }, [
    user,
    principal,
    rate,
    tenure,
    oneTimeAmount,
    oneTimeAtMonth,
    extraMonthly,
    extraStartMonth,
    stepUpEnabled,
    stepUpPct,
    useOneTime,
    useRecurring,
    result.interestSaved,
    result.monthsSaved,
    result.baseEmi,
    result.baseline.totalInterest,
    result.withPrepay.totalInterest,
  ]);

  // Save scenario
  const handleSave = () => {
    const list = listScenarios(user?.id ?? null);
    if (list.length >= MAX_SCENARIOS) {
      toast.error(
        `You've reached the maximum of ${MAX_SCENARIOS} scenarios. Delete one to save a new scenario.`,
      );
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
        onetimePrepayment: useOneTime ? oneTimeAmount : 0,
        totalInterest: result.withPrepay.totalInterest,
        interestSaved: result.interestSaved,
        closureMonthsFromNow: result.withPrepay.monthsToClose,
        timeSavedMonths: result.monthsSaved,
      },
    });
    const res = addScenario(user?.id ?? null, snap);
    if (res.ok) toast.success("Scenario saved.");
    else toast.error("Could not save scenario.");
  };

  const handleDownload = () => {
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
      "Without prepayment",
      `Total interest: ${formatINR(result.baseline.totalInterest)}`,
      `Total payable: ${formatINR(result.baseline.totalPaid)}`,
      `Loan closes: ${monthLabel(result.baseline.closureDate.year, result.baseline.closureDate.month)}`,
      "",
      "Prepayment scenario",
      useOneTime
        ? `One-time prepayment: ${formatINR(oneTimeAmount)} at month ${oneTimeAtMonth} (${oneTimeMode === "reduce_emi" ? "reduce EMI" : "shorten tenure"})`
        : "One-time prepayment: none",
      useRecurring
        ? `Extra monthly: ${formatINR(extraMonthly)} from month ${extraStartMonth}${stepUpEnabled ? `, +${stepUpPct}% per year` : ""}`
        : "Extra monthly: none",
      "",
      "With prepayment",
      `Total interest: ${formatINR(result.withPrepay.totalInterest)}`,
      `Loan closes: ${monthLabel(result.withPrepay.closureDate.year, result.withPrepay.closureDate.month)}`,
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
              See how prepayments and extra contributions reduce your interest burden and close
              your loan faster.
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
                      onClick={() => {
                        setEmiTouched(false);
                      }}
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
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Without any prepayment
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryRow label="Your monthly EMI" value={formatINR(result.baseEmi)} />
                  <SummaryRow
                    label="Total amount payable"
                    value={formatINR(result.baseline.totalPaid)}
                  />
                  <SummaryRow
                    label="Total interest payable"
                    value={formatINR(result.baseline.totalInterest)}
                  />
                  <SummaryRow
                    label="Loan closes in"
                    value={monthLabel(
                      result.baseline.closureDate.year,
                      result.baseline.closureDate.month,
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 — Prepayment builder */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Now let&apos;s see what prepayments do</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "onetime" | "recurring")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="onetime" disabled={combine}>
                    One-Time Prepayment
                  </TabsTrigger>
                  <TabsTrigger value="recurring" disabled={combine}>
                    Regular Extra Payment
                  </TabsTrigger>
                </TabsList>

                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="combine"
                    checked={combine}
                    onCheckedChange={(c) => setCombine(c === true)}
                  />
                  <Label htmlFor="combine" className="text-sm font-normal">
                    Combine both
                  </Label>
                </div>

                {!combine && (
                  <>
                    <TabsContent value="onetime" className="mt-5 space-y-5">
                      <OneTimeBlock
                        oneTimeAmount={oneTimeAmount}
                        setOneTimeAmount={setOneTimeAmount}
                        oneTimeAtMonth={oneTimeAtMonth}
                        setOneTimeAtMonth={setOneTimeAtMonth}
                        oneTimeMode={oneTimeMode}
                        setOneTimeMode={setOneTimeMode}
                        totalMonths={totalMonths}
                        startYear={startYear}
                        startMonth={startMonth}
                      />
                    </TabsContent>
                    <TabsContent value="recurring" className="mt-5 space-y-5">
                      <RecurringBlock
                        extraMonthly={extraMonthly}
                        setExtraMonthly={setExtraMonthly}
                        extraStartMonth={extraStartMonth}
                        setExtraStartMonth={setExtraStartMonth}
                        stepUpEnabled={stepUpEnabled}
                        setStepUpEnabled={setStepUpEnabled}
                        stepUpPct={stepUpPct}
                        setStepUpPct={setStepUpPct}
                        totalMonths={totalMonths}
                        startYear={startYear}
                        startMonth={startMonth}
                      />
                    </TabsContent>
                  </>
                )}
              </Tabs>

              {combine && (
                <div className="space-y-6">
                  <div className="space-y-5">
                    <p className="text-sm font-semibold text-foreground">One-time prepayment</p>
                    <OneTimeBlock
                      oneTimeAmount={oneTimeAmount}
                      setOneTimeAmount={setOneTimeAmount}
                      oneTimeAtMonth={oneTimeAtMonth}
                      setOneTimeAtMonth={setOneTimeAtMonth}
                      oneTimeMode={oneTimeMode}
                      setOneTimeMode={setOneTimeMode}
                      totalMonths={totalMonths}
                      startYear={startYear}
                      startMonth={startMonth}
                    />
                  </div>
                  <div className="space-y-5 border-t border-border pt-5">
                    <p className="text-sm font-semibold text-foreground">Regular extra payment</p>
                    <RecurringBlock
                      extraMonthly={extraMonthly}
                      setExtraMonthly={setExtraMonthly}
                      extraStartMonth={extraStartMonth}
                      setExtraStartMonth={setExtraStartMonth}
                      stepUpEnabled={stepUpEnabled}
                      setStepUpEnabled={setStepUpEnabled}
                      stepUpPct={stepUpPct}
                      setStepUpPct={setStepUpPct}
                      totalMonths={totalMonths}
                      startYear={startYear}
                      startMonth={startMonth}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3 — Impact */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Impact of your prepayment scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ComparisonPanel
                  title="Without prepayment"
                  monthlyEmi={result.baseEmi}
                  totalInterest={result.baseline.totalInterest}
                  closure={monthLabel(
                    result.baseline.closureDate.year,
                    result.baseline.closureDate.month,
                  )}
                />
                <ComparisonPanel
                  title="With prepayment"
                  monthlyEmi={result.withPrepay.points.at(-1)?.emi ?? result.baseEmi}
                  totalInterest={result.withPrepay.totalInterest}
                  closure={monthLabel(
                    result.withPrepay.closureDate.year,
                    result.withPrepay.closureDate.month,
                  )}
                  extras={[
                    {
                      label: "Interest saved",
                      value: formatINR(result.interestSaved),
                      highlight: true,
                    },
                    {
                      label: "Time saved",
                      value: formatYearsMonths(result.monthsSaved),
                      highlight: true,
                    },
                  ]}
                />
              </div>

              {(result.interestSaved > 0 || result.monthsSaved > 0) && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-base font-semibold text-foreground sm:text-lg">
                    You save{" "}
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {formatINR(result.interestSaved)}
                    </span>{" "}
                    in interest and close your loan{" "}
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {formatYearsMonths(result.monthsSaved)}
                    </span>{" "}
                    earlier.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Illustrative scenario based on the rates you entered.
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Your loan balance over time
                </p>
                <div className="h-72 rounded-2xl border border-border bg-background p-3">
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
                        formatter={(value) => formatINR(Number(value))}
                        labelFormatter={(label) => `Month ${label}`}
                        contentStyle={{
                          background: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="without"
                        name="Without prepayment"
                        stroke="var(--color-chart-3)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="with"
                        name="With prepayment"
                        stroke="var(--color-chart-1)"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The &quot;with prepayment&quot; line reaches zero in{" "}
                  {monthLabel(
                    result.withPrepay.closureDate.year,
                    result.withPrepay.closureDate.month,
                  )}
                  .
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 — Corpus connector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Using your corpus for prepayment</CardTitle>
              <p className="text-sm text-muted-foreground">
                If you use part of your built corpus for a prepayment at possession, here is what
                changes.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Corpus available at possession</Label>
                <CurrencyInput
                  value={corpusAvailable}
                  onValueChange={setCorpusAvailable}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>How much of corpus to use for prepayment?</Label>
                  <span className="text-sm font-medium text-foreground">{corpusUsedPct}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[corpusUsedPct]}
                  onValueChange={(v) => setCorpusUsedPct(v[0] ?? corpusUsedPct)}
                />
                <p className="text-sm text-muted-foreground">
                  Using {formatINR(corpusUsedAmount)} for prepayment, keeping{" "}
                  {formatINR(Math.max(0, corpusAvailable - corpusUsedAmount))} for other needs.
                </p>
              </div>

              <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                <SummaryRow
                  label="Updated interest saved"
                  value={formatINR(corpusResult.interestSaved)}
                />
                <SummaryRow
                  label="Updated loan closure"
                  value={monthLabel(
                    corpusResult.withPrepay.closureDate.year,
                    corpusResult.withPrepay.closureDate.month,
                  )}
                />
                <SummaryRow
                  label="Remaining corpus after prepayment"
                  value={formatINR(Math.max(0, corpusAvailable - corpusUsedAmount))}
                />
                <SummaryRow
                  label="Time saved (illustrative)"
                  value={formatYearsMonths(corpusResult.monthsSaved)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The remaining {formatINR(Math.max(0, corpusAvailable - corpusUsedAmount))} corpus
                can continue generating monthly withdrawals to support your EMI.
              </p>
            </CardContent>
          </Card>

          {/* Section 5 — AI nudge */}
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

          {/* Section 6 — Save / Download */}
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

function ComparisonPanel({
  title,
  monthlyEmi,
  totalInterest,
  closure,
  extras,
}: {
  title: string;
  monthlyEmi: number;
  totalInterest: number;
  closure: string;
  extras?: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">
        <SummaryRow label="Monthly EMI" value={formatINR(monthlyEmi)} />
        <SummaryRow label="Total interest" value={formatINR(totalInterest)} />
        <SummaryRow label="Loan closes" value={closure} />
        {extras?.map((e) => (
          <div key={e.label} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">{e.label}</span>
            <span
              className={
                e.highlight
                  ? "text-sm font-extrabold text-emerald-700 dark:text-emerald-400"
                  : "text-sm font-semibold text-foreground"
              }
            >
              {e.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
