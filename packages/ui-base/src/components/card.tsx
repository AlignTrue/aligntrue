import * as React from "react";

import { cn } from "../utils";

type CardVariant = "surface" | "elevated" | "feature";

const cardVariantStyles: Record<CardVariant, string> = {
  surface: "shadow-sm",
  elevated:
    "shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg border-primary/20",
  feature:
    "shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg",
};

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, React.PropsWithChildren {
  variant?: CardVariant;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "surface", ...props }, ref) => {
    const variantClass = (() => {
      switch (variant) {
        case "surface":
          return cardVariantStyles.surface;
        case "elevated":
          return cardVariantStyles.elevated;
        case "feature":
          return cardVariantStyles.feature;
        default:
          return cardVariantStyles.surface;
      }
    })();
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border bg-card text-card-foreground",
          variantClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
