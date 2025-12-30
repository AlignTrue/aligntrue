import React from "react";
import { statusIndicatorManifest } from "./manifest.js";

export interface StatusIndicatorProps {
  label: string;
  state: "ok" | "warning" | "error";
}

export function StatusIndicator({ label, state }: StatusIndicatorProps) {
  return (
    <div data-block="status-indicator">
      <span>{label}</span> — <strong>{state}</strong>
    </div>
  );
}

export { statusIndicatorManifest };
