import React from "react";
import { cn } from "../../ui/cn.js";
import { statusIndicatorManifest } from "./manifest.js";

export interface StatusIndicatorProps {
  label: string;
  state: "ok" | "warning" | "error";
}

export function StatusIndicator({ label, state }: StatusIndicatorProps) {
  const tone =
    state === "ok"
      ? "border-success/40 bg-success/10 text-success"
      : state === "warning"
        ? "border-warning/50 bg-warning/10 text-warning"
        : "border-destructive/50 bg-destructive/10 text-destructive";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        tone,
      )}
      data-block="status-indicator"
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      <span className="text-foreground">{label}</span>
      <span className="text-current">{state}</span>
    </div>
  );
}

export { statusIndicatorManifest };
