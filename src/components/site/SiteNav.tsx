import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="text-xl font-extrabold tracking-tight text-primary"
          aria-label="HomeAfford home"
        >
          HomeAfford
        </Link>

        <nav className="hidden items-center gap-3 md:flex">
          {session && <Button asChild variant="ghost"><Link to="/dashboard">Dashboard</Link></Button>}
          {session && <Button asChild variant="ghost"><Link to="/scenarios">My Scenarios</Link></Button>}
          <Button asChild variant="ghost"><Link to="/loan-relief">Loan Relief</Link></Button>
          {session && <Button asChild variant="ghost"><Link to="/compare" search={{ planA: undefined }}>Compare</Link></Button>}
          <Button asChild variant="ghost"><Link to="/pricing">Pricing</Link></Button>
          {session && <Button asChild variant="ghost"><Link to="/settings">Settings</Link></Button>}
          {session ? <Button variant="outline" onClick={handleSignOut}>Sign Out</Button> : (
          <>
          <Button asChild variant="outline">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Start Free</Link>
          </Button>
          </>)}
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-border/60 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6">
          {session && <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/dashboard">Dashboard</Link></Button>}
          {session && <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/scenarios">My Scenarios</Link></Button>}
          <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/loan-relief">Loan Relief</Link></Button>
          {session && <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/compare" search={{ planA: undefined }}>Compare</Link></Button>}
          <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/pricing">Pricing</Link></Button>
          {session && <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}><Link to="/settings">Settings</Link></Button>}
          {session ? <Button variant="outline" className="w-full" onClick={handleSignOut}>Sign Out</Button> : <>
          <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button asChild className="w-full" onClick={() => setOpen(false)}>
            <Link to="/auth">Start Free</Link>
          </Button>
          </>}
        </div>
      </div>
    </header>
  );
}
