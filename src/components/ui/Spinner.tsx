import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

export function Spinner({ className, size = 20, label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <Loader2
        className={cn("animate-spin text-current", className)}
        size={size}
        aria-hidden="true"
      />
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
