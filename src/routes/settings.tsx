import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeModal } from "@/components/plan/UpgradeModal";
import { useAuth } from "@/lib/auth";
import { hasProAccess } from "@/lib/subscription";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — HomeAfford" }, { name: "description", content: "Manage your HomeAfford account and subscription." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user, session, subscription, loading } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  React.useEffect(() => { if (!loading && !session) navigate({ to: "/auth" }); }, [loading, session, navigate]);
  if (loading || !session) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  const isPro = hasProAccess(subscription);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Button asChild variant="ghost" className="mb-6"><Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link></Button>
        <h1 className="text-3xl font-extrabold text-foreground">Account settings</h1>
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm text-muted-foreground">Current plan</p><Badge className="mt-2" variant={isPro ? "default" : "secondary"}>{isPro ? "Pro" : "Free"}</Badge>{isPro && subscription?.planExpiry && <p className="mt-2 text-sm text-muted-foreground">Expires on {new Date(subscription.planExpiry).toLocaleDateString("en-IN")}</p>}</div>
            {isPro ? <Button variant="outline" onClick={() => window.open("https://razorpay.com", "_blank")}>Manage Subscription</Button> : <Button onClick={() => setUpgradeOpen(true)}>Upgrade to Pro</Button>}
          </div>
          {isPro && <Button variant="ghost" className="mt-4 text-destructive hover:text-destructive" onClick={() => window.open("https://razorpay.com", "_blank")}>Cancel Subscription</Button>}
        </section>
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-bold text-foreground">Account details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs uppercase text-muted-foreground">Name</dt><dd className="mt-1 font-medium text-foreground">{user?.user_metadata?.full_name as string || user?.email?.split("@")[0]}</dd></div><div><dt className="text-xs uppercase text-muted-foreground">Email</dt><dd className="mt-1 font-medium text-foreground">{user?.email}</dd></div><div><dt className="text-xs uppercase text-muted-foreground">Joined</dt><dd className="mt-1 font-medium text-foreground">{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN") : "—"}</dd></div></dl>
        </section>
      </main>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}