export const LAUNCH_MODE = true;

export type PlanName = "free" | "pro";
export type PlanType = "monthly" | "annual";

export interface SubscriptionProfile {
  plan: PlanName;
  planType: PlanType | null;
  planStartDate: string | null;
  planExpiry: string | null;
  razorpaySubscriptionId: string | null;
}

export const FREE_PLAN_LIMITS = {
  savedPlans: 1,
};

export function hasProAccess(profile?: SubscriptionProfile | null) {
  if (LAUNCH_MODE) return true;
  if (!profile || profile.plan !== "pro") return false;
  if (!profile.planExpiry) return true;
  return new Date(profile.planExpiry).getTime() > Date.now();
}

export function proBadgeText() {
  return LAUNCH_MODE ? "Pro — Free during launch" : "Pro";
}