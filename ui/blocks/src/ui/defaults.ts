import type { BlockUIHints } from "@aligntrue/ui-contracts";

export const UI_DEFAULTS: Required<
  Pick<BlockUIHints, "tone" | "density" | "emphasis" | "chrome" | "interaction">
> = {
  tone: "neutral",
  density: "comfortable",
  emphasis: "flat",
  chrome: "card",
  interaction: "interactive",
};

export function withUiDefaults(hints?: BlockUIHints): BlockUIHints {
  return { ...UI_DEFAULTS, ...(hints ?? {}) };
}
