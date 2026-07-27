import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-sm font-medium text-stone-700",
          className,
        )}
        {...props}
      >
        {children}
        {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
      </label>
    );
  },
);

Label.displayName = "Label";
