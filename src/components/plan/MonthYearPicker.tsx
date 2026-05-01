import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parse(value: string | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function formatYearMonth(value: string | undefined): string {
  const p = parse(value);
  if (!p) return "";
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

export function MonthYearPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  ariaLabel?: string;
}) {
  const parsed = parse(value);
  const today = new Date();
  const monthStr = parsed ? String(parsed.month).padStart(2, "0") : "";
  const yearStr = parsed ? String(parsed.year) : "";

  const update = (mm: string, yy: string) => {
    if (!mm || !yy) {
      onChange(undefined);
      return;
    }
    onChange(`${yy}-${mm}`);
  };

  return (
    <div className="flex gap-2" aria-label={ariaLabel}>
      <Select
        value={monthStr}
        onValueChange={(v) => update(v, yearStr || String(today.getFullYear()))}
      >
        <SelectTrigger className="min-h-11">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => {
            const v = String(i + 1).padStart(2, "0");
            return (
              <SelectItem key={v} value={v}>
                {m}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Input
        className="min-h-11 w-24"
        inputMode="numeric"
        type="number"
        placeholder="Year"
        min={today.getFullYear()}
        max={today.getFullYear() + 50}
        value={yearStr}
        onChange={(e) => update(monthStr || "01", e.target.value)}
      />
    </div>
  );
}
