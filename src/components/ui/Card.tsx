import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padded?: boolean;
}

export function Card({
  header,
  footer,
  padded = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    >
      {header && (
        <div className="border-b border-stone-200 px-6 py-4">{header}</div>
      )}
      <div className={cn(padded && "p-6")}>{children}</div>
      {footer && (
        <div className="border-t border-stone-200 px-6 py-4">{footer}</div>
      )}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-heading text-lg text-stone-800", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm text-stone-500", className)} {...props}>
      {children}
    </p>
  );
}
