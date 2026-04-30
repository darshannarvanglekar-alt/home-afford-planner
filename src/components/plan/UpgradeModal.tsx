import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { PlanType } from "@/lib/subscription";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const FEATURES = [
  "Unlimited saved plans",
  "AI statement upload",
  "AI builder PDF extraction",
  "AI personalised suggestions",
  "Scenario simulator",
  "Property comparison",
  "Priority support",
];

export function UpgradeModal({
  open,
  onOpenChange,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}) {
  const [loadingPlan, setLoadingPlan] = React.useState<PlanType | null>(null);

  const subscribe = async (planType: PlanType) => {
    setLoadingPlan(planType);
    try {
      await loadRazorpayScript();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in before upgrading.");

      const res = await fetch("/api/create-razorpay-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const payload = await res.json() as { keyId?: string; subscriptionId?: string; name?: string; email?: string; error?: string };
      if (!res.ok || !payload.keyId || !payload.subscriptionId) throw new Error(payload.error || "Couldn't start checkout.");

      const checkout = new window.Razorpay!({
        key: payload.keyId,
        subscription_id: payload.subscriptionId,
        name: "HomeAfford Pro",
        description: planType === "monthly" ? "Pro Monthly" : "Pro Annual",
        prefill: { name: payload.name ?? "", email: payload.email ?? "" },
        theme: { color: "#4F46E5" },
        handler: async (response: Record<string, string>) => {
          const confirmRes = await fetch("/api/confirm-razorpay-subscription", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, planType }),
          });
          const confirmPayload = await confirmRes.json() as { error?: string };
          if (!confirmRes.ok) throw new Error(confirmPayload.error || "Payment verification failed.");
          toast.success("🎉 Welcome to Pro! All features are now unlocked.");
          onOpenChange(false);
          window.location.reload();
        },
        modal: { ondismiss: () => setLoadingPlan(null) },
      });
      checkout.open();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Upgrade to HomeAfford Pro</DialogTitle>
          <DialogDescription>
            {message || "Unlock the full power of AI-assisted home affordability planning"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard
            title="Pro Monthly"
            price="₹499"
            cadence="/ month"
            button="Subscribe Monthly"
            loading={loadingPlan === "monthly"}
            disabled={loadingPlan !== null}
            onClick={() => subscribe("monthly")}
          />
          <PlanCard
            title="Pro Annual"
            price="₹3,999"
            cadence="/ year"
            note="Save ₹2,000 vs monthly"
            button="Subscribe Annually"
            featured
            loading={loadingPlan === "annual"}
            disabled={loadingPlan !== null}
            onClick={() => subscribe("annual")}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No hidden charges.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ title, price, cadence, note, button, featured, loading, disabled, onClick }: {
  title: string; price: string; cadence: string; note?: string; button: string; featured?: boolean; loading: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <article className={cn("relative rounded-2xl border bg-card p-5 shadow-soft", featured ? "border-primary ring-2 ring-primary/15" : "border-border")}>
      {featured && <Badge className="absolute right-4 top-4">Popular</Badge>}
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-3xl font-extrabold text-foreground">{price}</span>
        <span className="pb-1 text-sm text-muted-foreground">{cadence}</span>
      </div>
      {note && <p className="mt-1 text-sm font-semibold text-success">{note}</p>}
      <ul className="mt-5 space-y-2 text-sm text-foreground">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>
      <Button type="button" className="mt-5 w-full" variant={featured ? "default" : "outline"} disabled={disabled} onClick={onClick}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {button}
      </Button>
    </article>
  );
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Payment failed. Please try again."));
    document.body.appendChild(script);
  });
}