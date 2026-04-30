import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HomeAfford — Know if you can really afford that home" },
      {
        name: "description",
        content:
          "AI-powered home affordability scenario simulator for Indian families. Upload statements or enter your numbers and get an illustrative month-by-month plan.",
      },
      { property: "og:title", content: "HomeAfford — India's first AI home affordability planner" },
      {
        property: "og:description",
        content:
          "Get a real month-by-month affordability plan — not just an EMI calculator. Built for Indian families.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: "📊",
    title: "Real Cash Flow Analysis",
    body: "We use your actual income, living expenses, EMIs and current investments. Not just your salary.",
  },
  {
    icon: "🏗️",
    title: "Builder Payment Ready",
    body: "Model staged builder payments and see exactly how each instalment affects your savings month by month.",
  },
  {
    icon: "🎯",
    title: "Safe / Stretch / Risky Verdict",
    body: "A clear, honest verdict on whether you can afford the home — with month-by-month detail and scenario testing.",
  },
];

const trustPoints = [
  "Understands your real expenses — not estimates",
  "Models under-construction staged payments",
  "Protects your emergency fund throughout",
  "Shows the true cost of affordability — not just if EMI fits",
];

const steps = [
  {
    n: 1,
    title: "Upload or Enter",
    body: "Upload 6 months of statements or enter your income and expenses manually. Takes 3 minutes.",
  },
  {
    n: 2,
    title: "Set Up Your Purchase",
    body: "Enter property cost, loan details, and builder payment plan. We handle the maths.",
  },
  {
    n: 3,
    title: "Get Your Plan",
    body: "See your month-by-month affordability plan, verdict, and exactly what you need to do next.",
  },
];

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden hero-gradient-animated">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.96_0.025_277)_0%,transparent_70%)]"
          />
          <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-4 py-1.5 text-xs font-semibold text-primary-soft-foreground sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              AI-Powered · India's First Home Affordability Planner
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Know if you can really afford that home.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Upload your statements or enter your numbers. Get a real month-by-month affordability
              plan — not just an EMI calculator.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/auth">Start Planning — It's Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>

            <p className="mt-5 text-xs text-muted-foreground sm:text-sm">
              🔒 Uploaded statements are deleted after processing. Your data stays private.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">Trusted by 100+ families</p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why HomeAfford */}
        <section className="bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why families trust HomeAfford
            </h2>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              {trustPoints.map((t) => (
                <div
                  key={t}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-soft"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium text-foreground">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Three simple steps to your personalised plan.
          </p>

          <div className="relative mt-12 grid gap-8 md:grid-cols-3">
            <div
              aria-hidden
              className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            />
            {steps.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-primary">
          <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Ready to plan your home the right way?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/85">
              Join thousands of Indian families making smarter home-buying decisions.
            </p>
            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="bg-background text-primary hover:bg-background/90"
              >
                <Link to="/auth">Start Planning Free</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
