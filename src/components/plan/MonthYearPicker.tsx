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

/** Months between two YYYY-MM strings (positive if b > a) */
export function monthsBetween(a: string | undefined, b: string | undefined): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

/** Today as YYYY-MM */
export function todayYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  const currentYear = today.getFullYear();

  // Keep year in a ref so month changes don't reset it
  const yearRef = React.useRef(parsed?.year ?? currentYear);
  const [monthStr, setMonthStr] = React.useState(
    parsed ? String(parsed.month).padStart(2, "0") : "",
  );
  const [yearInput, setYearInput] = React.useState(
    parsed ? String(parsed.year) : "",
  );

  // Sync from external value changes
  React.useEffect(() => {
    const p = parse(value);
    if (p) {
      yearRef.current = p.year;
      setMonthStr(String(p.month).padStart(2, "0"));
      setYearInput(String(p.year));
    }
  }, [value]);

  const emit = (mm: string, yy: number) => {
    if (!mm || !Number.isFinite(yy) || yy < 2020 || yy > 2060) {
      return;
    }
    const yyStr = String(yy);
    onChange(`${yyStr}-${mm}`);
  };

  const handleMonthChange = (mm: string) => {
    setMonthStr(mm);
    emit(mm, yearRef.current);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setYearInput(raw);
    const y = parseInt(raw, 10);
    if (y >= 2020 && y <= 2060) {
      yearRef.current = y;
      if (monthStr) {
        emit(monthStr, y);
      }
    }
  };

  return (
    <div className="flex gap-2" aria-label={ariaLabel}>
      <Select value={monthStr} onValueChange={handleMonthChange}>
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
        min={2020}
        max={2060}
        value={yearInput}
        onChange={handleYearChange}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
