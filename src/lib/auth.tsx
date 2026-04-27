import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionProfile } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  subscription: SubscriptionProfile | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [subscription, setSubscription] = React.useState<SubscriptionProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  const refreshSubscription = React.useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setSubscription(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("plan, plan_type, plan_start_date, plan_expiry, razorpay_subscription_id")
      .eq("id", userId)
      .maybeSingle();
    const row = data as unknown as {
      plan?: "free" | "pro";
      plan_type?: "monthly" | "annual" | null;
      plan_start_date?: string | null;
      plan_expiry?: string | null;
      razorpay_subscription_id?: string | null;
    } | null;
    setSubscription({
      plan: row?.plan ?? "free",
      planType: row?.plan_type ?? null,
      planStartDate: row?.plan_start_date ?? null,
      planExpiry: row?.plan_expiry ?? null,
      razorpaySubscriptionId: row?.razorpay_subscription_id ?? null,
    });
  }, []);

  React.useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_OUT" && session) setSessionExpired(true);
      setSession(newSession);
      setLoading(false);
      window.setTimeout(() => void refreshSubscription(), 0);
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setLoading(false);
      void refreshSubscription();
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshSubscription]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      subscription,
      loading,
      refreshSubscription,
      signOut: async () => {
        await supabase.auth.signOut();
        setSubscription(null);
      },
    }),
    [session, subscription, loading, refreshSubscription],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Dialog open={sessionExpired} onOpenChange={setSessionExpired}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your session has expired.</DialogTitle>
            <DialogDescription>Please sign in again. Any draft data already entered will remain in this browser until you return.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild onClick={() => setSessionExpired(false)}>
              <Link to="/auth">Sign In</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
