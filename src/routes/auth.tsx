import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HomeAfford" },
      {
        name: "description",
        content: "Sign in or create your HomeAfford account to start your home affordability plan.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // If already logged in, bounce to dashboard
  React.useEffect(() => {
    if (!authLoading && session) {
      navigate({ to: "/dashboard" });
    }
  }, [session, authLoading, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/dashboard`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: firstName ? { first_name: firstName } : undefined,
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to HomeAfford.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-card sm:p-8">
          <div className="text-center">
            <Link to="/" className="text-2xl font-extrabold text-primary">
              HomeAfford
            </Link>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
              Welcome to HomeAfford
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to start or continue your affordability plan
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Priya"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait…
                </>
              ) : mode === "signin" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              or continue with
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("google")}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("apple")}
            >
              <AppleIcon />
              Continue with Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            🔒 Your bank statements are processed securely and permanently deleted after analysis.
            We never store your financial files.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1S8.69 6 12 6c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.39 14.65 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.54 0 9.2-3.89 9.2-9.37 0-.63-.07-1.11-.16-1.59H12z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.46 2.27-1.21 3.07-.79.87-2.06 1.54-3.1 1.46-.13-1.13.42-2.31 1.16-3.06.84-.86 2.27-1.5 3.15-1.47zM20.5 17.36c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.13 3.51-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.01-3.07-1.76-4.06-3.32C.06 16.74-.34 11.4 1.55 8.55c1.34-2.02 3.46-3.21 5.45-3.21 2.03 0 3.31 1.11 4.99 1.11 1.63 0 2.62-1.11 4.97-1.11 1.78 0 3.66.97 5 2.65-4.4 2.4-3.69 8.66.54 9.37z" />
    </svg>
  );
}
