import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, Star, Trash2, GitCompareArrows, Upload, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/plan-schema";
import {
  deleteScenario,
  listScenarios,
  markPreferred,
  stagePendingLoad,
  type SavedScenario,
} from "@/lib/scenarios";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title: "My Scenarios — HomeAfford" },
      {
        name: "description",
        content: "Save, compare, and revisit your home affordability scenarios.",
      },
    ],
  }),
  component: ScenariosPage,
});

function ScenariosPage() {
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  const [scenarios, setScenarios] = React.useState<SavedScenario[]>([]);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [confirmLoadId, setConfirmLoadId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refresh = React.useCallback(() => {
    setScenarios(listScenarios(user?.id));
  }, [user?.id]);

  React.useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("homeafford:scenarios-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("homeafford:scenarios-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) {
        toast.error("You can compare up to 3 scenarios at a time. Remove one to add another.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const compared = scenarios.filter((s) => compareIds.includes(s.id));

  const handleLoad = (id: string) => setConfirmLoadId(id);

  const performLoad = (mode: "save-first" | "anyway") => {
    if (!confirmLoadId) return;
    const target = scenarios.find((s) => s.id === confirmLoadId);
    if (!target) return;
    if (mode === "save-first") {
      toast.message("Save your current plan from the Results page first, then load this scenario.");
      setConfirmLoadId(null);
      return;
    }
    stagePendingLoad(target);
    toast.success(`Loading "${target.name}" into the simulator…`);
    setConfirmLoadId(null);
    navigate({ to: "/plan/new", search: { step: 1 } });
  };

  const performDelete = () => {
    if (!confirmDeleteId) return;
    deleteScenario(user?.id, confirmDeleteId);
    setCompareIds((prev) => prev.filter((i) => i !== confirmDeleteId));
    setConfirmDeleteId(null);
    toast.success("Scenario removed");
    refresh();
  };

  if (loading || !session) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Bookmark className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                My Scenarios
              </h1>
              <p className="text-sm text-muted-foreground">
                Save versions of your plan and compare them side by side.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        {scenarios.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                selected={compareIds.includes(s.id)}
                onCompare={() => toggleCompare(s.id)}
                onLoad={() => handleLoad(s.id)}
                onDelete={() => setConfirmDeleteId(s.id)}
              />
            ))}
          </div>
        )}

        {compared.length >= 2 && (
          <ComparisonPanel
            scenarios={compared}
            onClose={() => setCompareIds([])}
            onMarkPreferred={(id) => {
              markPreferred(user?.id, id);
              refresh();
              toast.success("Marked as your plan");
            }}
            onRemove={(id) => toggleCompare(id)}
          />
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          HomeAfford is a scenario planning tool. All projections are illustrative and not
          financial, investment, or loan advice.
        </p>
      </main>
      <SiteFooter />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the saved snapshot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmLoadId} onOpenChange={(o) => !o && setConfirmLoadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load this scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current unsaved inputs. Save current plan first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="sm:order-1">Cancel</AlertDialogCancel>
            <Button variant="secondary" onClick={() => performLoad("save-first")} className="sm:order-2">
              Save current first
            </Button>
            <AlertDialogAction onClick={() => performLoad("anyway")} className="sm:order-3">
              Load anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Bookmark className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground">No scenarios saved yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          On the Results page of your plan, tap "Save This Scenario" to keep a snapshot of your
          current numbers. You can save up to 10 and compare any 2 or 3 side by side.
        </p>
        <Button asChild className="mt-2">
          <Link to="/plan/new" search={{ step: 1 }}>
            Open the simulator
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({
  scenario,
  selected,
  onCompare,
  onLoad,
  onDelete,
}: {
  scenario: SavedScenario;
  selected: boolean;
  onCompare: () => void;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const date = new Date(scenario.savedAt);
  return (
    <Card className={cn(selected && "ring-2 ring-primary")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            {scenario.preferred && <Star className="h-4 w-4 fill-warning text-warning" />}
            <span className="font-bold">{scenario.name}</span>
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip label="EMI" value={formatINR(scenario.outputs.monthlyEMI)} />
          <Chip label="Corpus" value={formatINR(scenario.outputs.projectedCorpus)} />
          <Chip
            label="Status"
            value={scenario.outputs.affordabilityLabel}
            tone={
              scenario.outputs.affordabilityLabel === "Comfortable"
                ? "success"
                : scenario.outputs.affordabilityLabel === "Stretch"
                  ? "warning"
                  : "danger"
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selected ? "default" : "secondary"}
            onClick={onCompare}
            className="min-h-11"
          >
            <GitCompareArrows className="h-4 w-4" />
            {selected ? "Selected" : "Compare"}
          </Button>
          <Button size="sm" variant="outline" onClick={onLoad} className="min-h-11">
            <Upload className="h-4 w-4" /> Load
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="min-h-11 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "success" && "border-success/30 bg-success-soft text-success-soft-foreground",
        tone === "warning" && "border-warning/30 bg-warning-soft text-warning-soft-foreground",
        tone === "danger" && "border-destructive/30 bg-danger-soft text-danger-soft-foreground",
        !tone && "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className="opacity-70">{label}:</span> <span className="font-semibold">{value}</span>
    </span>
  );
}

type Row = {
  label: string;
  values: (string | number)[];
  // higherIsBetter | lowerIsBetter | none
  best?: "high" | "low" | "none";
  numeric?: boolean;
  raw?: number[];
};

function ComparisonPanel({
  scenarios,
  onClose,
  onMarkPreferred,
  onRemove,
}: {
  scenarios: SavedScenario[];
  onClose: () => void;
  onMarkPreferred: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [preferred, setPreferred] = React.useState<string>(scenarios[0].id);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Income & Expenses",
      rows: [
        rowINR("Monthly income", scenarios.map((s) => s.outputs.monthlyIncome), "high"),
        rowINR("Monthly expenses", scenarios.map((s) => s.outputs.monthlyExpenses), "low"),
        rowINR("Existing EMIs", scenarios.map((s) => s.outputs.existingEmis), "low"),
        rowINR("Monthly surplus", scenarios.map((s) => s.outputs.monthlySurplus), "high"),
      ],
    },
    {
      title: "Home & Loan",
      rows: [
        rowINR("Property price", scenarios.map((s) => s.outputs.propertyPrice), "none"),
        rowINR("Down payment", scenarios.map((s) => s.outputs.downPayment), "none"),
        rowINR("Loan amount", scenarios.map((s) => s.outputs.loanAmount), "low"),
        rowText(
          "Annual interest rate",
          scenarios.map((s) => `${s.outputs.interestRate.toFixed(2)}%`),
          scenarios.map((s) => s.outputs.interestRate),
          "low",
        ),
        rowText(
          "Loan tenure",
          scenarios.map((s) => `${s.outputs.tenureYears} yrs`),
          scenarios.map((s) => s.outputs.tenureYears),
          "low",
        ),
        rowINR("Monthly EMI", scenarios.map((s) => s.outputs.monthlyEMI), "low"),
      ],
    },
    {
      title: "Corpus Plan",
      rows: [
        rowINR(
          "Monthly investment (total)",
          scenarios.map((s) => s.corpus?.monthlyInvestment ?? s.inputs.finances.expenses.investments ?? 0),
          "high",
        ),
        rowText(
          "Assumed return",
          scenarios.map((s) =>
            s.corpus?.assumedReturnPct ? `${s.corpus.assumedReturnPct}%` : "—",
          ),
          scenarios.map((s) => s.corpus?.assumedReturnPct ?? 0),
          "high",
        ),
        rowText(
          "Step-up enabled?",
          scenarios.map((s) => (s.corpus?.stepUp ? "Yes" : "No")),
          scenarios.map((s) => (s.corpus?.stepUp ? 1 : 0)),
          "high",
        ),
        rowINR("Projected corpus", scenarios.map((s) => s.outputs.projectedCorpus), "high"),
        rowINR("Target corpus", scenarios.map((s) => s.outputs.targetCorpus), "none"),
        rowINR("Corpus shortfall / surplus", scenarios.map((s) => s.outputs.corpusGap), "high"),
      ],
    },
    {
      title: "Loan Relief",
      rows: [
        rowINR(
          "One-time prepayment planned",
          scenarios.map((s) => s.loanRelief?.onetimePrepayment ?? 0),
          "high",
        ),
        rowINR(
          "Total interest payable",
          scenarios.map((s) => s.loanRelief?.totalInterest ?? 0),
          "low",
        ),
        rowINR(
          "Interest saved vs original",
          scenarios.map((s) => s.loanRelief?.interestSaved ?? 0),
          "high",
        ),
        rowText(
          "Time saved",
          scenarios.map((s) =>
            s.loanRelief?.timeSavedMonths ? `${s.loanRelief.timeSavedMonths} mo` : "—",
          ),
          scenarios.map((s) => s.loanRelief?.timeSavedMonths ?? 0),
          "high",
        ),
      ],
    },
    {
      title: "Overall Result",
      rows: [
        rowText(
          "Affordability status",
          scenarios.map((s) => s.outputs.affordabilityLabel),
          scenarios.map((s) =>
            s.outputs.affordabilityLabel === "Comfortable"
              ? 2
              : s.outputs.affordabilityLabel === "Stretch"
                ? 1
                : 0,
          ),
          "high",
        ),
        rowINR(
          "Surplus after EMI & investments",
          scenarios.map((s) => s.outputs.surplusAfterEmi),
          "high",
        ),
        rowText(
          "Safety buffer",
          scenarios.map((s) => s.outputs.safetyBuffer),
          scenarios.map((s) => (s.outputs.safetyBuffer === "Built" ? 1 : 0)),
          "high",
        ),
      ],
    },
  ];

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Side-by-side comparison</h2>
          <p className="text-xs text-muted-foreground">
            Best value in each row is highlighted in green. Up to 3 scenarios.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card p-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metric
              </th>
              {scenarios.map((s) => (
                <th key={s.id} className="p-2 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1 font-bold text-foreground">
                        {s.preferred && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                        {s.name}
                      </div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        {new Date(s.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(s.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove from comparison"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <React.Fragment key={section.title}>
                <tr>
                  <td
                    colSpan={scenarios.length + 1}
                    className="bg-muted/40 p-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {section.title}
                  </td>
                </tr>
                {section.rows.map((row) => {
                  const bestIdx = computeBestIndex(row);
                  return (
                    <tr key={row.label} className="border-b border-border">
                      <td className="sticky left-0 z-10 bg-card p-2 align-top text-xs font-medium text-muted-foreground">
                        {row.label}
                      </td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className={cn(
                            "p-2 align-top text-sm font-medium",
                            i === bestIdx && "bg-success-soft text-success-soft-foreground",
                          )}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Preferred:</span>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPreferred(s.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                preferred === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <Button
          onClick={() => onMarkPreferred(preferred)}
          className="min-h-11"
        >
          <Star className="h-4 w-4" />
          Mark "{scenarios.find((s) => s.id === preferred)?.name}" as My Plan
        </Button>
      </div>
    </section>
  );
}

function computeBestIndex(row: Row): number {
  if (!row.best || row.best === "none" || !row.raw) return -1;
  const values = row.raw;
  if (values.every((v) => v === values[0])) return -1;
  let bestIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (row.best === "high" ? values[i] > values[bestIdx] : values[i] < values[bestIdx])
      bestIdx = i;
  }
  return bestIdx;
}

function rowINR(label: string, raw: number[], best: Row["best"]): Row {
  return {
    label,
    values: raw.map((v) => formatINR(v)),
    raw,
    best,
    numeric: true,
  };
}

function rowText(label: string, values: string[], raw: number[], best: Row["best"]): Row {
  return { label, values, raw, best };
}
