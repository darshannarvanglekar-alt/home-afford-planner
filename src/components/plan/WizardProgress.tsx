import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Your Finances" },
  { n: 2, label: "Your Home" },
  { n: 3, label: "Your Profile" },
  { n: 4, label: "Your Plan" },
];

export function WizardProgress({ current }: { current: number }) {
  const pct = ((current - 1) / (STEPS.length - 1)) * 100;
  return (
    <div className="w-full">
      {/* Mobile: current step label */}
      <div className="mb-3 flex items-center justify-between sm:hidden">
        <span className="text-xs font-medium text-muted-foreground">
          Step {current} of {STEPS.length}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {STEPS[current - 1]?.label}
        </span>
      </div>

      <div className="relative">
        {/* Track */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" aria-hidden />
        <div
          className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
          aria-hidden
        />

        <ol className="relative flex justify-between">
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <li key={s.n} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : s.n}
                </div>
                <span
                  className={cn(
                    "hidden text-center text-xs font-medium sm:block",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
