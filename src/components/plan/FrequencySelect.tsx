import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_FREQUENCIES,
  paymentFrequencyLabels,
  type PaymentFrequency,
} from "@/lib/plan-schema";

export function FrequencySelect({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: PaymentFrequency;
  onChange: (v: PaymentFrequency) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentFrequency)}>
      <SelectTrigger
        aria-label={ariaLabel ?? "Payment frequency"}
        className={className ?? "min-h-11 w-full"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_FREQUENCIES.map((f) => (
          <SelectItem key={f} value={f}>
            {paymentFrequencyLabels[f]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
