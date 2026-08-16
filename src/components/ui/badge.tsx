import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-muted text-foreground hover:bg-muted/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline: "border-border text-foreground",
        success: "border-success/35 bg-success/12 text-success",
        warning: "border-warning/35 bg-warning/15 text-foreground",
        danger: "border-destructive/35 bg-destructive/12 text-destructive",
        info: "border-info/35 bg-info/12 text-info",
        brand: "border-primary/35 bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
