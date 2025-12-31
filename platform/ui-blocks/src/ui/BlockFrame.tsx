import type { BlockShellProps } from "@aligntrue/ui-renderer";
import { cva } from "class-variance-authority";
import { cn } from "./cn.js";
import { withUiDefaults } from "./defaults.js";

const blockFrameVariants = cva(
  "rounded-lg border bg-card text-card-foreground transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border",
        info: "border-accent bg-accent/10",
        success: "border-success bg-success/10",
        warning: "border-warning bg-warning/10",
        danger: "border-destructive bg-destructive/10",
      },
      density: {
        compact: "p-3",
        comfortable: "p-4",
      },
      emphasis: {
        flat: "shadow-none",
        raised: "shadow-sm",
      },
      chrome: {
        card: "bg-card",
        panel: "bg-secondary",
        none: "bg-transparent border-transparent",
      },
      interaction: {
        static: "",
        interactive: "hover:border-ring",
      },
    },
    defaultVariants: {
      tone: "neutral",
      density: "comfortable",
      emphasis: "flat",
      chrome: "card",
      interaction: "interactive",
    },
  },
);

export function BlockFrame({ manifest, ui, children }: BlockShellProps) {
  const hints = withUiDefaults(ui ?? manifest.ui);
  return (
    <div
      className={cn(blockFrameVariants(hints))}
      data-block-id={manifest.block_id}
    >
      {children}
    </div>
  );
}
