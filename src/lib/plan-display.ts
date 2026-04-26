import {
  calculateAffordabilityPlan,
  defaultFinances,
  defaultHome,
  defaultProfile,
  financesSchema,
  formatINR,
  homeSchema,
  profileSchema,
  type AffordabilityVerdict,
  type Finances,
  type Home,
  type Profile,
} from "@/lib/plan-schema";

export interface ParsedPlanData {
  finances: Finances;
  home: Home;
  profile: Profile;
  verdict: AffordabilityVerdict;
}

export function parsePlanData(data: unknown): ParsedPlanData {
  const blob = (data ?? {}) as { finances?: unknown; home?: unknown; profile?: unknown };
  const finances = financesSchema.safeParse(blob.finances).success
    ? financesSchema.parse(blob.finances)
    : defaultFinances;
  const home = homeSchema.safeParse(blob.home).success ? homeSchema.parse(blob.home) : defaultHome;
  const profile = profileSchema.safeParse(blob.profile).success
    ? profileSchema.parse(blob.profile)
    : defaultProfile;
  const verdict = calculateAffordabilityPlan(finances, home, profile).verdict;
  return { finances, home, profile, verdict };
}

export function propertyTypeLabel(type: Home["propertyType"]) {
  if (type === "construction") return "Under Construction";
  if (type === "plot") return "Plot";
  return "Ready to Move";
}

export function formatCompactINR(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return formatINR(0);
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${Number.isInteger(cr) ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    const lakh = amount / 100000;
    return `₹${Number.isInteger(lakh) ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  return formatINR(amount);
}

export function suggestPlanName(home: Home) {
  const type = propertyTypeLabel(home.propertyType);
  const cost = formatCompactINR(home.propertyCost);
  const location = home.city.trim();
  const subject = home.propertyType === "plot" ? "Plot" : home.propertyType === "construction" ? "Under-Construction" : "Ready-to-Move";

  if (location) return `${location} ${subject} · ${cost}`;
  if (home.propertyType === "plot") return `Plot · ${cost}`;
  return `${type} Home · ${cost}`;
}

export function timeAgo(input: string) {
  const timestamp = new Date(input).getTime();
  if (!Number.isFinite(timestamp)) return "Recently updated";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
