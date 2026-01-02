import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionBadgeProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "cta";
};

export function SectionBadge({
  children,
  className,
  variant = "default",
}: SectionBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 w-fit mx-auto rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        variant === "default" &&
          "bg-primary/10 text-primary border border-primary/20",
        variant === "cta" &&
          "bg-primary/10 text-foreground border border-white/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
