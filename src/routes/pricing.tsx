import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HomeAfford" },
      { name: "description", content: "Simple HomeAfford pricing with one free plan and Pro AI planning." },
    ],
  }),
  component: PricingPage,
});

const rows = [
  ["Saved plans", "1", "Unlimited"],
  ["Basic verdict", true, true],
  ["Manual entry", true, true],
  ["AI statement upload", false, true],
  ["AI builder extraction", false, true],
  ["AI suggestions", false, true],
  ["Scenario simulator", false, true],
  ["Property comparison", false, true],
] as const;

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Start free, then unlock unlimited AI-assisted planning when you're ready.</p>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-5 px-4 sm:px-6 md:grid-cols-2">
          <PlanCard title="Free" price="₹0" subtitle="1 saved plan included" features={["1 saved plan", "Basic verdict", "Manual entry"]} />
          <PlanCard title="Pro" price="₹499/mo" subtitle="or ₹3,999/year" features={["Unlimited saved plans", "All AI features", "Scenario simulator", "Property comparison", "Priority support"]} featured />
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-foreground">
                <tr><th className="p-4">Feature</th><th className="p-4 text-center">Free</th><th className="p-4 text-center">Pro</th></tr>
              </thead>
              <tbody>
                {rows.map(([feature, free, pro]) => <tr key={feature} className="border-t border-border"><td className="p-4 font-medium text-foreground">{feature}</td><td className="p-4 text-center">{cell(free)}</td><td className="p-4 text-center">{cell(pro)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-muted/40">
          <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3">
            <Faq q="Is my uploaded data safe?" a="Yes. Your statements are analysed instantly and permanently deleted. We never store your financial files." />
            <Faq q="Can I cancel anytime?" a="Yes. Cancel from your account settings anytime. No questions asked." />
            <Faq q="Is there a free trial?" a="Yes — 1 complete plan is always free. No credit card required." />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PlanCard({ title, price, subtitle, features, featured }: { title: string; price: string; subtitle: string; features: string[]; featured?: boolean }) {
  return <article className={`rounded-2xl border bg-card p-6 shadow-soft ${featured ? "border-primary ring-2 ring-primary/15" : "border-border"}`}>{featured && <Badge>Popular</Badge>}<h2 className="mt-2 text-2xl font-extrabold text-foreground">{title}</h2><p className="mt-3 text-3xl font-extrabold text-primary">{price}</p><p className="text-sm text-muted-foreground">{subtitle}</p><ul className="mt-5 space-y-2 text-sm text-foreground">{features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-success" />{f}</li>)}</ul><Button asChild className="mt-6 w-full" variant={featured ? "default" : "outline"}><Link to="/auth">Get Started</Link></Button></article>;
}

function cell(value: string | boolean) { return typeof value === "string" ? <span className="font-semibold text-foreground">{value}</span> : value ? <Check className="mx-auto h-5 w-5 text-success" /> : <X className="mx-auto h-5 w-5 text-destructive" />; }
function Faq({ q, a }: { q: string; a: string }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-soft"><h3 className="font-bold text-foreground">{q}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p></article>; }