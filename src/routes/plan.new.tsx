import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WizardProgress } from "@/components/plan/WizardProgress";
import { Step1Finances } from "@/components/plan/Step1Finances";
import { Step2Home } from "@/components/plan/Step2Home";
import { Step3Profile } from "@/components/plan/Step3Profile";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultFinances,
  defaultHome,
  defaultProfile,
  financesSchema,
  homeSchema,
  profileSchema,
  type Finances,
  type Home,
  type Profile,
} from "@/lib/plan-schema";

const searchSchema = z.object({
  step: fallback(z.number().int().min(1).max(4), 1).default(1),
  planId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/plan/new")({
  head: () => ({
    meta: [
      { title: "New Plan — HomeAfford" },
      { name: "description", content: "Build your home affordability plan." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: PlanWizardPage,
});

function PlanWizardPage() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const { step, planId } = Route.useSearch();

  const [finances, setFinances] = React.useState<Finances>(defaultFinances);
  const [home, setHome] = React.useState<Home>(defaultHome);
  const [profile, setProfile] = React.useState<Profile>(defaultProfile);
  const [planReady, setPlanReady] = React.useState(false);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");

  // Auth guard
  React.useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth" });
    }
  }, [authLoading, session, navigate]);

  // Create or load draft plan
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      if (planId) {
        const { data, error } = await supabase
          .from("plans")
          .select("id, data")
          .eq("id", planId)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          toast.error("Couldn't load that plan.");
          navigate({ to: "/dashboard" });
          return;
        }

        const blob = (data.data ?? {}) as {
          finances?: unknown;
          home?: unknown;
          profile?: unknown;
        };
        const parsedF = financesSchema.safeParse(blob.finances);
        if (parsedF.success) setFinances(parsedF.data);
        const parsedH = homeSchema.safeParse(blob.home);
        if (parsedH.success) setHome(parsedH.data);
        const parsedP = profileSchema.safeParse(blob.profile);
        if (parsedP.success) setProfile(parsedP.data);
        setPlanReady(true);
      } else {
        const { data, error } = await supabase
          .from("plans")
          .insert({
            user_id: user.id,
            name: "Untitled plan",
            status: "draft",
            data: {},
          })
          .select("id")
          .single();

        if (cancelled) return;

        if (error || !data) {
          toast.error("Couldn't start a new plan.");
          navigate({ to: "/dashboard" });
          return;
        }

        navigate({
          to: "/plan/new",
          search: { step: 1, planId: data.id },
          replace: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, planId, navigate]);

  // Debounced auto-save
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = React.useRef(true);

  React.useEffect(() => {
    if (!planId || !planReady) return;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("plans")
        .update({ data: { finances, home, profile } })
        .eq("id", planId);
      if (error) {
        setSaveState("idle");
        toast.error("Couldn't save your changes.");
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      }
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [finances, home, profile, planId, planReady]);

  if (authLoading || !session || !planId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canGoNext =
    step === 1
      ? finances.income.primarySalary > 0
      : step === 2
        ? home.propertyCost > 0
        : true;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/dashboard" className="text-lg font-extrabold text-primary">
              HomeAfford
            </Link>
            <SaveIndicator state={saveState} />
          </div>
          <WizardProgress current={step} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {step === 1 ? (
          <Step1Finances value={finances} onChange={setFinances} />
        ) : step === 2 ? (
          <Step2Home value={home} onChange={setHome} />
        ) : step === 3 ? (
          <Step3Profile value={profile} onChange={setProfile} />
        ) : (
          <ComingSoon step={step} />
        )}

        <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            asChild={step === 1}
            onClick={
              step === 1
                ? undefined
                : () =>
                    navigate({
                      to: "/plan/new",
                      search: { step: step - 1, planId },
                    })
            }
          >
            {step === 1 ? (
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" />
                Back
              </>
            )}
          </Button>

          {step < 4 ? (
            <Button
              size="lg"
              disabled={!canGoNext}
              onClick={() =>
                navigate({
                  to: "/plan/new",
                  search: { step: step + 1, planId },
                })
              }
            >
              {step === 1
                ? "Next: Your Home"
                : step === 2
                  ? "Next: Your Profile"
                  : "Next: Your Plan"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" disabled>
              Finish
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Auto-save on</span>;
}

function ComingSoon({ step }: { step: number }) {
  const titles: Record<number, string> = {
    2: "Your Home",
    3: "Your Profile",
    4: "Your Plan",
  };
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <h2 className="text-xl font-bold text-foreground">{titles[step]}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This step is coming soon. Your finances are saved.
      </p>
    </div>
  );
}
