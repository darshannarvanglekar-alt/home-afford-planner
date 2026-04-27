import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, BarChart3, Loader2, Save, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { parsePlanData, propertyTypeLabel, suggestPlanName } from "@/lib/plan-display";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  calcEMI,
  calculateAffordabilityPlan,
  defaultHome,
  formatINR,
  loanAmount,
  type AffordabilityVerdict,
  type Finances,
  type Home,
  type Profile,
} from "@/lib/plan-schema";

const searchSchema = z.object({
  planA: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Properties — HomeAfford" },
      { name: "description", content: "Compare two homes side by side on affordability metrics." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: ComparePage,
});

interface PlanRow {
  id: string;
  name: string;
  verdict: string | null;
  data: unknown;
  updated_at: string;
}

type SideKey = "A" | "B";
type CompareSide = { mode: "new" | "saved"; planId: string; name: string; home: Home };
type ResultSide = ReturnType<typeof buildMetrics>;
type Results = { A: ResultSide; B: ResultSide };

type RowTone = "higher" | "lower" | "verdict" | "status" | "none";
interface CompareRow {
  section: string;
  metric: string;
  a: string;
  b: string;
  aRaw?: number | string;
  bRaw?: number | string;
  tone?: RowTone;
}

const newSide = (label: SideKey): CompareSide => ({
  mode: "new",
  planId: "new",
  name: `Property ${label}`,
  home: { ...defaultHome, propertyType: "ready", propertyCost: 0, downPayment: 0, builderStages: defaultHome.builderStages.map((s) => ({ ...s })) },
});

function ComparePage() {
  const navigate = useNavigate();
  const { planA } = Route.useSearch();
  const { user, session, loading: authLoading } = useAuth();
  const [plans, setPlans] = React.useState<PlanRow[] | null>(null);
  const [sideA, setSideA] = React.useState<CompareSide>(newSide("A"));
  const [sideB, setSideB] = React.useState<CompareSide>(newSide("B"));
  const [sharedFinances, setSharedFinances] = React.useState<Finances | null>(null);
  const [sharedProfile, setSharedProfile] = React.useState<Profile | null>(null);
  const [results, setResults] = React.useState<Results | null>(null);
  const [summary, setSummary] = React.useState("");
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [savingSide, setSavingSide] = React.useState<SideKey | null>(null);

  React.useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, verdict, data, updated_at")
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load saved plans.");
        setPlans([]);
        return;
      }

      const rows = data ?? [];
      setPlans(rows);
      if (rows.length > 0) {
        const latest = parsePlanData(rows[0].data);
        setSharedFinances(latest.finances);
        setSharedProfile(latest.profile);

        const first = rows.find((p) => p.id === planA) ?? rows[0];
        const second = rows.find((p) => p.id !== first.id);
        setSideA(sideFromPlan(first));
        setSideB(second ? sideFromPlan(second) : newSide("B"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, planA]);

  const noPlans = plans !== null && plans.length === 0;
  const canCompare = !!sharedFinances && !!sharedProfile && sideA.home.propertyCost > 0 && sideB.home.propertyCost > 0;

  const selectPlan = (side: SideKey, value: string) => {
    const setter = side === "A" ? setSideA : setSideB;
    if (value === "new") {
      setter(newSide(side));
      setResults(null);
      setSummary("");
      return;
    }
    const plan = plans?.find((p) => p.id === value);
    if (plan) {
      setter(sideFromPlan(plan));
      setResults(null);
      setSummary("");
    }
  };

  const updateSide = (side: SideKey, patch: Partial<CompareSide> | ((current: CompareSide) => CompareSide)) => {
    const setter = side === "A" ? setSideA : setSideB;
    setter((current) => (typeof patch === "function" ? patch(current) : { ...current, ...patch }));
    setResults(null);
    setSummary("");
  };

  const compareNow = async () => {
    if (noPlans) {
      toast.error("Please complete at least one plan first.");
      return;
    }
    if (!sharedFinances || !sharedProfile) return;
    if (!canCompare) {
      toast.error("Add property cost for both properties before comparing.");
      return;
    }

    setComparing(true);
    const nextResults = {
      A: buildMetrics("Property A", sideA, sharedFinances, sharedProfile),
      B: buildMetrics("Property B", sideB, sharedFinances, sharedProfile),
    };
    setResults(nextResults);
    setComparing(false);
    await generateSummary(nextResults);
  };

  const generateSummary = async (nextResults: Results) => {
    setSummaryLoading(true);
    setSummary("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in to generate the AI summary.");

      const response = await fetch("/api/generate-comparison-summary", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ propertyA: summaryPayload(nextResults.A), propertyB: summaryPayload(nextResults.B) }),
      });
      const payload = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "We couldn't generate the AI summary right now.");
      setSummary(payload.summary);
    } catch (error) {
      setSummary(error instanceof Error ? error.message : "We couldn't generate the AI summary right now.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const saveAsPlan = async (side: SideKey) => {
    if (!user || !sharedFinances || !sharedProfile || !results) return;
    const selected = side === "A" ? sideA : sideB;
    const metrics = side === "A" ? results.A : results.B;
    setSavingSide(side);
    const name = selected.name.trim() || suggestPlanName(selected.home);
    const { error } = await supabase.from("plans").insert({
      user_id: user.id,
      name,
      status: "saved",
      verdict: metrics.verdict,
      data: { finances: sharedFinances, home: selected.home, profile: sharedProfile },
    });
    setSavingSide(null);
    if (error) toast.error("Couldn't save this property as a plan.");
    else toast.success(`${name} saved as a plan.`);
  };

  if (authLoading || !session || plans === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/dashboard" className="text-lg font-extrabold text-primary">HomeAfford</Link>
          <Button variant="ghost" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Compare Two Properties</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">See which home works better for your finances — side by side.</p>
          </div>
          <Badge variant="secondary" className="w-fit">Shared profile from latest saved plan</Badge>
        </div>

        {noPlans ? (
          <Card className="mt-8">
            <CardContent className="p-6 text-center sm:p-10">
              <BarChart3 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-xl font-extrabold text-foreground">Please complete at least one plan first so we can use your financial profile for comparison.</h2>
              <Button className="mt-6 w-full sm:max-w-sm" size="lg" onClick={() => navigate({ to: "/plan/new", search: { step: 1, planId: undefined } })}>Compare Now</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <PropertyCard side="A" labelClassName="text-primary" plans={plans} value={sideA} onSelect={selectPlan} onChange={updateSide} />
              <PropertyCard side="B" labelClassName="text-warning" plans={plans} value={sideB} onSelect={selectPlan} onChange={updateSide} />
            </section>

            <Button className="mt-5 h-12 w-full text-base font-semibold" onClick={() => void compareNow()} disabled={comparing}>
              {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              Compare Now
            </Button>

            {results && <ComparisonResults results={results} summary={summary} summaryLoading={summaryLoading} onSave={saveAsPlan} savingSide={savingSide} onReset={() => { setResults(null); setSummary(""); }} />}
          </>
        )}
      </main>
    </div>
  );
}

function PropertyCard({ side, labelClassName, plans, value, onSelect, onChange }: { side: SideKey; labelClassName: string; plans: PlanRow[]; value: CompareSide; onSelect: (side: SideKey, value: string) => void; onChange: (side: SideKey, patch: Partial<CompareSide> | ((current: CompareSide) => CompareSide)) => void }) {
  const updateHome = (patch: Partial<Home>) => onChange(side, (current) => ({ ...current, mode: current.mode === "saved" ? "new" : current.mode, planId: current.mode === "saved" ? "new" : current.planId, home: { ...current.home, ...patch } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("text-base font-extrabold", labelClassName)}>Property {side}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select a saved plan or enter new property</Label>
          <Select value={value.mode === "saved" ? value.planId : "new"} onValueChange={(next) => onSelect(side, next)}>
            <SelectTrigger><SelectValue placeholder="Select a saved plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Enter new property</SelectItem>
              {plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Property name" className="sm:col-span-2"><Input value={value.name} placeholder="Property name" onChange={(event) => onChange(side, { name: event.target.value, mode: value.mode === "saved" ? "new" : value.mode, planId: value.mode === "saved" ? "new" : value.planId })} /></Field>
          <NumberField label="Property cost (₹)" value={value.home.propertyCost} onChange={(propertyCost) => updateHome({ propertyCost })} />
          <NumberField label="Down payment (₹)" value={value.home.downPayment} onChange={(downPayment) => updateHome({ downPayment })} />
          <NumberField label="Interest rate (%)" value={value.home.interestRateA} onChange={(interestRateA) => updateHome({ interestRateA })} />
          <NumberField label="Tenure (years)" value={value.home.tenureYears} onChange={(tenureYears) => updateHome({ tenureYears: Math.max(1, Math.round(tenureYears)) })} />
          <Field label="Property type">
            <Select value={value.home.propertyType} onValueChange={(propertyType: Home["propertyType"]) => updateHome({ propertyType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready to Move</SelectItem>
                <SelectItem value="construction">Under Construction</SelectItem>
                <SelectItem value="plot">Plot</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumberField label="Possession month" value={value.home.possessionMonth} onChange={(possessionMonth) => updateHome({ possessionMonth: Math.max(1, Math.round(possessionMonth)) })} />
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonResults({ results, summary, summaryLoading, onSave, savingSide, onReset }: { results: Results; summary: string; summaryLoading: boolean; onSave: (side: SideKey) => Promise<void>; savingSide: SideKey | null; onReset: () => void }) {
  const rows = buildRows(results);
  return (
    <section className="mt-8 space-y-6">
      <div className="hidden md:block"><ComparisonTable rows={rows} /></div>
      <div className="md:hidden">
        <Tabs defaultValue="compare">
          <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="a">Property A</TabsTrigger><TabsTrigger value="b">Property B</TabsTrigger><TabsTrigger value="compare">Compare</TabsTrigger></TabsList>
          <TabsContent value="a"><MobileSide rows={rows} side="a" /></TabsContent>
          <TabsContent value="b"><MobileSide rows={rows} side="b" /></TabsContent>
          <TabsContent value="compare" className="overflow-x-auto"><ComparisonTable rows={rows} /></TabsContent>
        </Tabs>
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" />AI Summary</CardTitle></CardHeader>
        <CardContent>
          {summaryLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Generating summary…</p> : <p className="text-sm leading-6 text-foreground">{summary}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" onClick={() => void onSave("A")} disabled={savingSide !== null}>{savingSide === "A" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Property A as Plan</Button>
        <Button variant="outline" onClick={() => void onSave("B")} disabled={savingSide !== null}>{savingSide === "B" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Property B as Plan</Button>
        <Button variant="ghost" onClick={onReset}><RefreshCw className="h-4 w-4" />Change Properties</Button>
      </div>
    </section>
  );
}

function ComparisonTable({ rows }: { rows: CompareRow[] }) {
  let currentSection = "";
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead>Property A</TableHead><TableHead>Property B</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((row) => {
              const showSection = row.section !== currentSection;
              currentSection = row.section;
              return (
                <React.Fragment key={`${row.section}-${row.metric}`}>
                  {showSection && <TableRow><TableCell colSpan={3} className="bg-muted/60 text-xs font-extrabold uppercase tracking-normal text-muted-foreground">{row.section}</TableCell></TableRow>}
                  <TableRow><TableCell className="font-medium">{row.metric}</TableCell><ValueCell row={row} side="a" /><ValueCell row={row} side="b" /></TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MobileSide({ rows, side }: { rows: CompareRow[]; side: "a" | "b" }) {
  return <Card><CardContent className="space-y-3 p-4">{rows.filter((row) => row.metric).map((row) => <div key={`${side}-${row.section}-${row.metric}`} className={cn("rounded-lg border border-border p-3", cellTone(row, side))}><p className="text-xs font-medium text-muted-foreground">{row.metric}</p><p className="mt-1 font-extrabold text-foreground">{side === "a" ? row.a : row.b}</p></div>)}</CardContent></Card>;
}

function ValueCell({ row, side }: { row: CompareRow; side: "a" | "b" }) {
  return <TableCell className={cn("font-semibold", cellTone(row, side))}>{side === "a" ? row.a : row.b}</TableCell>;
}

function cellTone(row: CompareRow, side: "a" | "b") {
  const winner = betterSide(row);
  if (!winner) return "";
  return winner === side ? "bg-success-soft/60 text-success-soft-foreground" : "bg-warning-soft/60 text-warning-soft-foreground";
}

function betterSide(row: CompareRow): "a" | "b" | null {
  if (row.tone === "none" || row.aRaw === row.bRaw) return null;
  if (row.tone === "higher") return Number(row.aRaw) > Number(row.bRaw) ? "a" : "b";
  if (row.tone === "lower") return Number(row.aRaw) < Number(row.bRaw) ? "a" : "b";
  if (row.tone === "verdict") return verdictRank(row.aRaw as AffordabilityVerdict) > verdictRank(row.bRaw as AffordabilityVerdict) ? "a" : "b";
  if (row.tone === "status") return statusRank(String(row.aRaw)) > statusRank(String(row.bRaw)) ? "a" : "b";
  return null;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><Input type="number" min="0" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value) || 0)} /></Field>;
}

function sideFromPlan(plan: PlanRow): CompareSide {
  const parsed = parsePlanData(plan.data);
  return { mode: "saved", planId: plan.id, name: plan.name, home: parsed.home };
}

function buildMetrics(label: string, side: CompareSide, finances: Finances, profile: Profile) {
  const plan = calculateAffordabilityPlan(finances, side.home, profile);
  const principal = loanAmount(side.home);
  const totalInterest = Math.max(0, plan.newEmi * side.home.tenureYears * 12 - principal);
  const affordabilityScore = Math.round(plan.layerScores.reduce((sum, layer) => sum + layer.score, 0) / plan.layerScores.length);
  const monthlyInvestment = Math.max(0, finances.expenses.investments + Math.min(0, plan.surplusAfterEmi));
  const month60Corpus = futureValueMonthly(monthlyInvestment, 60, 0.12);
  const stage1 = stagePayment(side.home, 0);
  const stage2 = stagePayment(side.home, 1);
  const prePossessionEmi = calcEMI(prePossessionPrincipal(side.home), side.home.interestRateA, side.home.tenureYears);
  return {
    label,
    name: side.name,
    propertyType: side.home.propertyType,
    propertyCost: side.home.propertyCost,
    downPayment: side.home.downPayment,
    loanAmount: principal,
    interestRate: side.home.interestRateA,
    tenureYears: side.home.tenureYears,
    monthlyEmi: plan.newEmi,
    monthlySurplus: plan.surplusAfterEmi,
    emiToIncomeRatio: plan.emiToIncomePct,
    surplusAfterEmi: plan.surplusAfterEmi,
    verdict: plan.verdict,
    affordabilityScore,
    emergencyFundStatus: plan.emergencyStatus,
    negativeSurplusMonths: plan.surplusAfterEmi < 0 ? Math.min(60, side.home.tenureYears * 12) : 0,
    totalInterest,
    totalCostOfOwnership: side.home.propertyCost + side.home.registrationStampDuty + side.home.interiorBudget + totalInterest,
    month60Corpus,
    investmentContinuity: plan.surplusAfterEmi >= finances.expenses.investments * 0.5 ? "Maintained" : "Reduced",
    stage1,
    stage2,
    possessionMonth: side.home.possessionMonth,
    prePossessionEmi,
  };
}

function buildRows(results: Results): CompareRow[] {
  const rows: CompareRow[] = [
    row("PURCHASE DETAILS", "Property Cost", formatINR(results.A.propertyCost), formatINR(results.B.propertyCost), results.A.propertyCost, results.B.propertyCost, "lower"),
    row("PURCHASE DETAILS", "Down Payment", formatINR(results.A.downPayment), formatINR(results.B.downPayment), results.A.downPayment, results.B.downPayment, "higher"),
    row("PURCHASE DETAILS", "Loan Amount", formatINR(results.A.loanAmount), formatINR(results.B.loanAmount), results.A.loanAmount, results.B.loanAmount, "lower"),
    row("PURCHASE DETAILS", "Interest Rate", `${results.A.interestRate}%`, `${results.B.interestRate}%`, results.A.interestRate, results.B.interestRate, "lower"),
    row("PURCHASE DETAILS", "Tenure", `${results.A.tenureYears} yrs`, `${results.B.tenureYears} yrs`, results.A.tenureYears, results.B.tenureYears, "lower"),
    row("MONTHLY IMPACT", "Monthly EMI", formatINR(results.A.monthlyEmi), formatINR(results.B.monthlyEmi), results.A.monthlyEmi, results.B.monthlyEmi, "lower"),
    row("MONTHLY IMPACT", "Monthly Surplus", formatINR(results.A.monthlySurplus), formatINR(results.B.monthlySurplus), results.A.monthlySurplus, results.B.monthlySurplus, "higher"),
    row("MONTHLY IMPACT", "EMI to Income Ratio", `${results.A.emiToIncomeRatio.toFixed(1)}%`, `${results.B.emiToIncomeRatio.toFixed(1)}%`, results.A.emiToIncomeRatio, results.B.emiToIncomeRatio, "lower"),
    row("MONTHLY IMPACT", "Surplus after EMI", formatINR(results.A.surplusAfterEmi), formatINR(results.B.surplusAfterEmi), results.A.surplusAfterEmi, results.B.surplusAfterEmi, "higher"),
    row("AFFORDABILITY", "Verdict", results.A.verdict.toUpperCase(), results.B.verdict.toUpperCase(), results.A.verdict, results.B.verdict, "verdict"),
    row("AFFORDABILITY", "Affordability Score", `${results.A.affordabilityScore}/100`, `${results.B.affordabilityScore}/100`, results.A.affordabilityScore, results.B.affordabilityScore, "higher"),
    row("AFFORDABILITY", "Emergency Fund Status", results.A.emergencyFundStatus, results.B.emergencyFundStatus, results.A.emergencyFundStatus, results.B.emergencyFundStatus, "status"),
    row("AFFORDABILITY", "Months with -ve surplus", String(results.A.negativeSurplusMonths), String(results.B.negativeSurplusMonths), results.A.negativeSurplusMonths, results.B.negativeSurplusMonths, "lower"),
    row("LONG TERM", "Total Interest Payable", formatINR(results.A.totalInterest), formatINR(results.B.totalInterest), results.A.totalInterest, results.B.totalInterest, "lower"),
    row("LONG TERM", "Total Cost of Ownership", formatINR(results.A.totalCostOfOwnership), formatINR(results.B.totalCostOfOwnership), results.A.totalCostOfOwnership, results.B.totalCostOfOwnership, "lower"),
    row("LONG TERM", "Month-60 Corpus", formatINR(results.A.month60Corpus), formatINR(results.B.month60Corpus), results.A.month60Corpus, results.B.month60Corpus, "higher"),
    row("LONG TERM", "Investment continuity", results.A.investmentContinuity, results.B.investmentContinuity, results.A.investmentContinuity, results.B.investmentContinuity, "status"),
  ];

  if (results.A.propertyType === "construction" || results.B.propertyType === "construction") {
    rows.push(
      row("BUILDER STAGES", "Stage 1 Payment", formatINR(results.A.stage1), formatINR(results.B.stage1), results.A.stage1, results.B.stage1, "lower"),
      row("BUILDER STAGES", "Stage 2 Payment", formatINR(results.A.stage2), formatINR(results.B.stage2), results.A.stage2, results.B.stage2, "lower"),
      row("BUILDER STAGES", "Possession Month", `M ${results.A.possessionMonth}`, `M ${results.B.possessionMonth}`, results.A.possessionMonth, results.B.possessionMonth, "lower"),
      row("BUILDER STAGES", "Pre-possession EMI", formatINR(results.A.prePossessionEmi), formatINR(results.B.prePossessionEmi), results.A.prePossessionEmi, results.B.prePossessionEmi, "lower"),
    );
  }

  return rows;
}

function row(section: string, metric: string, a: string, b: string, aRaw: number | string, bRaw: number | string, tone: RowTone): CompareRow {
  return { section, metric, a, b, aRaw, bRaw, tone };
}

function verdictRank(verdict: AffordabilityVerdict) {
  return verdict === "safe" ? 3 : verdict === "stretch" ? 2 : 1;
}

function statusRank(status: string) {
  if (status === "Protected" || status === "Maintained") return 3;
  if (status === "Tight") return 2;
  return 1;
}

function futureValueMonthly(monthly: number, months: number, annualRate: number) {
  const r = annualRate / 12;
  if (monthly <= 0) return 0;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

function stagePayment(home: Home, index: number) {
  const stage = home.builderStages[index];
  return stage ? (stage.bankPays || 0) + (stage.youPay || 0) : 0;
}

function prePossessionPrincipal(home: Home) {
  if (home.propertyType !== "construction") return loanAmount(home);
  const stagedPrincipal = home.builderStages.filter((stage) => stage.month <= home.possessionMonth).reduce((sum, stage) => sum + (stage.bankPays || 0), 0);
  return stagedPrincipal || loanAmount(home);
}

function summaryPayload(metrics: ResultSide) {
  return {
    label: metrics.label,
    propertyCost: metrics.propertyCost,
    downPayment: metrics.downPayment,
    loanAmount: metrics.loanAmount,
    interestRate: metrics.interestRate,
    tenureYears: metrics.tenureYears,
    monthlyEmi: metrics.monthlyEmi,
    monthlySurplus: metrics.monthlySurplus,
    emiToIncomeRatio: metrics.emiToIncomeRatio,
    verdict: metrics.verdict,
    affordabilityScore: metrics.affordabilityScore,
    emergencyFundStatus: metrics.emergencyFundStatus,
    totalInterest: metrics.totalInterest,
    totalCostOfOwnership: metrics.totalCostOfOwnership,
    month60Corpus: metrics.month60Corpus,
    investmentContinuity: metrics.investmentContinuity,
  };
}
