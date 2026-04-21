import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Home, LogOut, User as UserIcon, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — HomeAfford" },
      { name: "description", content: "Your HomeAfford dashboard." },
    ],
  }),
  component: DashboardPage,
});

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  status: string;
  verdict: string | null;
  created_at: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [plans, setPlans] = React.useState<PlanRow[] | null>(null);

  // Protect route
  React.useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/auth" });
    }
  }, [session, authLoading, navigate]);

  // Load profile + plans
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [{ data: prof }, { data: planData, error: planErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("id, name, status, verdict, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      setProfile(prof ?? null);
      if (planErr) {
        toast.error("Couldn't load your plans.");
        setPlans([]);
      } else {
        setPlans(planData ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    navigate({ to: "/" });
  };

  if (authLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const firstName =
    profile?.first_name ||
    (user?.user_metadata?.first_name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "there");

  const initials = (firstName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="text-xl font-extrabold text-primary">
            HomeAfford
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-muted">
                <Avatar className="h-8 w-8">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={firstName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-foreground sm:inline">
                  {firstName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{firstName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <UserIcon className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            Let's build your home affordability plan.
          </p>
        </div>

        {/* Start a new plan */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-soft via-card to-card p-6 shadow-card sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-glow">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Start a New Plan</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Plan a new home or plot purchase
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => toast.info("The plan wizard is coming soon.")}
              >
                <Plus className="h-4 w-4" />
                Start New Plan
              </Button>
            </div>
          </div>
        </section>

        {/* Saved plans */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">My Saved Plans</h2>

          <div className="mt-4">
            {plans === null ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">No plans yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start your first plan above.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3">
                {plans.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div>
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.status}
                        {p.verdict ? ` · ${p.verdict}` : ""}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Open
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
