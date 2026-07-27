import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "warm"
  | "forest"
  | "neutral"
  | "draft"
  | "published";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-warm-100 text-warm-800",
  warm: "bg-warm-100 text-warm-800",
  forest: "bg-forest-100 text-forest-800",
  neutral: "bg-stone-100 text-stone-700",
  draft: "bg-stone-100 text-stone-600",
  published: "bg-forest-100 text-forest-700",
};

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
