import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (n: number) => void;
}

function formatGroups(n: number): string {
  if (!n) return "";
  return Math.round(n).toLocaleString("en-IN");
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, placeholder, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>(value ? String(value) : "");

    React.useEffect(() => {
      if (!focused) setDraft(value ? String(value) : "");
    }, [value, focused]);

    const display = focused
      ? draft
      : value
        ? formatGroups(value)
        : "";

    return (
      <div className={cn("relative", className)}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          ₹
        </span>
        <input
          ref={ref}
          inputMode="numeric"
          type="text"
          value={display}
          placeholder={placeholder}
          onFocus={() => {
            setFocused(true);
            setDraft(value ? String(value) : "");
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "");
            setDraft(raw);
            const n = raw === "" ? 0 : Number.parseInt(raw, 10);
            onValueChange(Number.isFinite(n) ? n : 0);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent pl-7 pr-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          {...props}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
