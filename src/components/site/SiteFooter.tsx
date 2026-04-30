import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="text-xl font-extrabold text-primary">
              HomeAfford
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Smart home affordability planning for Indian families.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <a href="#" className="hover:text-foreground">
              Contact
            </a>
          </nav>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>
            HomeAfford is a scenario planning tool. All projections are illustrative and not
            financial, investment, or loan advice.
          </p>
          <p className="mt-2">© 2026 HomeAfford. Made in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
