import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WizardProgress } from "@/components/plan/WizardProgress";
import { Step1Finances } from "@/components/plan/Step1Finances";
import { StepCurrentInvestments } from "@/components/plan/StepCurrentInvestments";
import { Step2Home } from "@/components/plan/Step2Home";
import { StepPaymentPlan } from "@/components/plan/StepPaymentPlan";
import { StepLoan } from "@/components/plan/StepLoan";
import { Step3Profile } from "@/components/plan/Step3Profile";
import { Step4Plan } from "@/components/plan/Step4Plan";
import { Progress } from "@/components/ui/progress";
import { UpgradeModal } from "@/components/plan/UpgradeModal";
import { LoadingLogo } from "@/components/LoadingLogo";
import { useAuth } from "@/lib/auth";
import { hasProAccess } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultFinances,
  defaultHome,
  defaultProfile,
  financesSchema,
  homeSchema,
  investmentsSchema,
  profileSchema,
  type Finances,
  type CurrentInvestment,
  type Home,
  type Profile,
} from "@/lib/plan-schema";
import {
  type PaymentPlanInputs,
  defaultPaymentPlanInputs,
} from "@/lib/payment-plan";
import { suggestPlanName } from "@/lib/plan-display";
import { takePendingLoad } from "@/lib/scenarios";

const searchSchema = z.object({
  step: fallback(z.number().int().min(1).max(7), 1).default(1),
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
  const { user, session, subscription, loading: authLoading } = useAuth();
  const { step, planId } = Route.useSearch();

  const [finances, setFinances] = React.useState<Finances>(defaultFinances);
  const [investments, setInvestments] = React.useState<CurrentInvestment[]>([]);
  const [home, setHome] = React.useState<Home>(defaultHome);
  const [paymentPlan, setPaymentPlan] = React.useState<PaymentPlanInputs>(defaultPaymentPlanInputs);
  const [profile, setProfile] = React.useState<Profile>(defaultProfile);
  const [planName, setPlanName] = React.useState("");
  const [planReady, setPlanReady] = React.useState(false);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [calculating, setCalculating] = React.useState(false);
  const [upgradeMessage, setUpgradeMessage] = React.useState("");
  const [navDirection, setNavDirection] = React.useState<"next" | "back">("next");
  const [validationError, setValidationError] = React.useState("");

  // Auth guard
  React.useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth" });
    }
  }, [authLoading, session, navigate]);

  // Hydrate from a staged scenario load (from My Scenarios → Load)
  React.useEffect(() => {
    const pending = takePendingLoad();
    if (!pending) return;
    setFinances(pending.inputs.finances);
    setInvestments(pending.inputs.investments);
    setHome(pending.inputs.home);
    setProfile(pending.inputs.profile);
    if (pending.name) setPlanName(pending.name);
    toast.success(`Loaded "${pending.name}"`);
  }, []);

  // Create or load draft plan
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      if (planId) {
        const { data, error } = await supabase
          .from("plans")
          .select("id, name, data")
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
          investments?: unknown;
          profile?: unknown;
        };
        const parsedF = financesSchema.safeParse(blob.finances);
        if (parsedF.success) setFinances(parsedF.data);
        const parsedI = investmentsSchema.safeParse(blob.investments);
        if (parsedI.success) setInvestments(parsedI.data);
        const parsedH = homeSchema.safeParse(blob.home);
        if (parsedH.success) setHome(parsedH.data);
        const parsedP = profileSchema.safeParse(blob.profile);
        if (parsedP.success) setProfile(parsedP.data);
        setPlanName(data.name ?? "");
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
      const nextName =
        planName.trim() && planName !== "Untitled plan" ? planName : suggestPlanName(home);
      const { error } = await supabase
        .from("plans")
        .update({ name: nextName, data: { finances, investments, home, profile, paymentPlan: paymentPlan as unknown as Record<string, unknown> } })
        .eq("id", planId);
      if (error) {
        setSaveState("idle");
        toast.error("Couldn't save your changes.");
      } else {
        setPlanName(nextName);
        setSaveState("saved");
        toast.success("✅ Plan saved successfully");
        setTimeout(() => setSaveState("idle"), 1500);
      }
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [finances, investments, home, profile, planId, planName, planReady]);

  const updatePlanName = async (name: string) => {
    if (!planId) return;
    const nextName = name || suggestPlanName(home);
    setPlanName(nextName);
    setSaveState("saving");
    const { error } = await supabase.from("plans").update({ name: nextName }).eq("id", planId);
    if (error) {
      toast.error("Couldn't save plan name.");
      setSaveState("idle");
    } else {
      setSaveState("saved");
      toast.success("✅ Plan renamed");
      setTimeout(() => setSaveState("idle"), 1500);
    }
  };

  if (authLoading || !session || !planId) {
    return <LoadingLogo />;
  }

  const goToStep = (nextStep: number) => {
    setValidationError("");
    setNavDirection(nextStep > step ? "next" : "back");
    navigate({
      to: "/plan/new",
      search: { step: nextStep, planId },
    });
  };

  const validateStep = () => {
    if (step === 1 && finances.income.primarySalary <= 0) {
      setValidationError("Please enter your Primary Salary to continue.");
      toast.error("Please enter your monthly salary to continue");
      return false;
    }
    if (step === 3) {
      if (home.propertyCost <= 0) {
        setValidationError("Please enter the Property Cost to continue.");
        return (toast.error("Please enter the property cost to continue"), false);
      }
    }
    if (step === 5) {
      if (home.downPayment > home.propertyCost) {
        setValidationError("Down Payment cannot exceed Property Cost.");
        return (toast.error("Down payment cannot exceed property cost"), false);
      }
      if (home.interestRateA < 1 || home.interestRateA > 20) {
        setValidationError("Please enter an Expected interest rate between 1% and 20%.");
        return (toast.error("Please enter a valid interest rate between 1% and 20%"), false);
      }
      if (!home.tenureYears) {
        setValidationError("Please select a Loan Tenure to continue.");
        return (toast.error("Please select a loan tenure"), false);
      }
    }
    setValidationError("");
    return true;
  };

  const calculatePlan = () => {
    try {
      const parsedFinances = financesSchema.safeParse(finances);
      const parsedInvestments = investmentsSchema.safeParse(investments ?? []);
      const parsedHome = homeSchema.safeParse(home);
      const parsedProfile = profileSchema.safeParse(profile);

      if (!parsedFinances.success) {
        const message = formatValidationIssue("Your Finances", parsedFinances.error);
        console.error("Calculate My Plan blocked by finances validation", parsedFinances.error.flatten());
        setValidationError(message);
        toast.error(message);
        return;
      }
      if (!parsedInvestments.success) {
        const message = formatValidationIssue("My Current Investments", parsedInvestments.error);
        console.error(
          "Calculate My Plan blocked by current investments validation",
          parsedInvestments.error.flatten(),
        );
        setValidationError(message);
        toast.error(message);
        return;
      }
      if (!parsedHome.success) {
        const message = formatValidationIssue("Your Home", parsedHome.error);
        console.error("Calculate My Plan blocked by home validation", parsedHome.error.flatten());
        setValidationError(message);
        toast.error(message);
        return;
      }
      if (!parsedProfile.success) {
        const message = formatValidationIssue("Your Profile", parsedProfile.error);
        console.error("Calculate My Plan blocked by profile validation", parsedProfile.error.flatten());
        setValidationError(message);
        toast.error(message);
        return;
      }

      setValidationError("");
      setCalculating(true);
      window.setTimeout(() => {
        setCalculating(false);
        goToStep(7);
      }, 2300);
    } catch (error) {
      console.error("Calculate My Plan failed", error);
      setCalculating(false);
      setValidationError("Something went wrong while calculating your plan. Please review your numbers.");
      toast.error("Something went wrong while calculating your plan. Please review your numbers");
    }
  };

  const requestUpgrade = (message: string) => setUpgradeMessage(message);
  const canUseProFeatures = hasProAccess(subscription);

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
        {calculating && <CalculatingPlan />}
        <div
          key={step}
          className={
            navDirection === "next"
              ? "animate-step-slide"
              : "animate-step-slide [animation-direction:reverse]"
          }
        >
          {step === 1 ? (
            <Step1Finances
              value={finances}
              onChange={setFinances}
              canUseProFeatures={canUseProFeatures}
              onUpgradeRequired={requestUpgrade}
            />
          ) : step === 2 ? (
            <StepCurrentInvestments
              value={investments}
              possessionMonth={home.possessionMonth}
              onChange={setInvestments}
            />
          ) : step === 3 ? (
            <Step2Home
              value={home}
              onChange={setHome}
              canUseProFeatures={canUseProFeatures}
              onUpgradeRequired={requestUpgrade}
            />
          ) : step === 4 ? (
            <StepPaymentPlan value={paymentPlan} onChange={setPaymentPlan} home={home} />
          ) : step === 5 ? (
            <StepLoan value={home} onChange={setHome} />
          ) : step === 6 ? (
            <Step3Profile value={profile} onChange={setProfile} />
          ) : step === 7 ? (
            <Step4Plan
              finances={finances}
              investments={investments}
              home={home}
              profile={profile}
              onFinancesChange={setFinances}
              onHomeChange={setHome}
              onProfileChange={setProfile}
              planName={planName}
              onPlanNameChange={(name) => void updatePlanName(name)}
              canUseProFeatures={canUseProFeatures}
              onUpgradeRequired={requestUpgrade}
            />
          ) : (
            <ComingSoon step={step} />
          )}
        </div>

        {!calculating && (
          <div className="sticky bottom-0 -mx-4 mt-10 flex flex-col-reverse gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <Button
              variant="ghost"
              asChild={step === 1}
              onClick={step === 1 ? undefined : () => goToStep(step - 1)}
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

            {step < 7 ? (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {validationError ? (
                  <p className="text-sm font-medium text-destructive">{validationError}</p>
                ) : null}
                <Button
                  size="lg"
                  className={step === 6 ? "h-12 px-8 text-base font-semibold" : undefined}
                  onClick={() => {
                    if (!validateStep()) return;
                    if (step === 6) {
                      calculatePlan();
                    } else {
                      goToStep(step + 1);
                    }
                  }}
                >
                  {step === 1
                    ? "Next: My Current Investments"
                    : step === 2
                      ? "Next: Your Home"
                      : step === 3
                        ? "Next: Payment Plan"
                        : step === 4
                          ? "Next: Your Loan"
                          : step === 5
                            ? "Next: Your Profile"
                            : "Calculate My Plan"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="lg" onClick={() => goToStep(1)}>
                Edit Plan
              </Button>
            )}
          </div>
        )}
      </main>
      <UpgradeModal
        open={!!upgradeMessage}
        onOpenChange={(open) => !open && setUpgradeMessage("")}
        message={upgradeMessage}
      />
    </div>
  );
}

function formatValidationIssue(section: string, error: z.ZodError) {
  const firstIssue = error.issues[0];
  const field = firstIssue?.path.length ? firstIssue.path.join(" → ") : section;
  return `Please review ${section}: ${field} needs a valid value.`;
}

function CalculatingPlan() {
  const messages = [
    "Analysing your income and expenses...",
    "Calculating your monthly cash flow...",
    "Running affordability checks...",
    "Generating your personalised plan...",
    "Almost ready...",
  ];
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      1500,
    );
    return () => window.clearInterval(timer);
  }, [messages.length]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="h-1 w-full overflow-hidden bg-primary/15">
        <div className="h-full w-2/3 animate-pulse bg-primary" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="animate-logo-pulse text-3xl font-extrabold text-primary">HomeAfford</div>
        <Loader2 className="mt-8 h-8 w-8 animate-spin text-primary" />
        <h1 className="mt-5 text-xl font-extrabold text-foreground sm:text-2xl">
          Building your personalised affordability plan...
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{messages[index]}</p>
        <div className="mt-6 w-full max-w-sm">
          <Progress value={72} />
        </div>
      </div>
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
    2: "My Current Investments",
    3: "Your Home",
    4: "Your Profile",
    5: "Your Plan",
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
