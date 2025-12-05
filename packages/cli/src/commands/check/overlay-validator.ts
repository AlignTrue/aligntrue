import type { Align } from "@aligntrue/schema";
import type {
  AlignTrueConfig,
  OverlayDefinition,
  OverlayValidationResult as CoreOverlayResult,
} from "@aligntrue/core";
import { validateOverlays } from "@aligntrue/core";

export interface OverlayValidationResult {
  valid: boolean;
  warnings: string[];
  errors?: CoreOverlayResult["errors"];
  raw: CoreOverlayResult;
}

/**
 * Validate overlays in config against current Align document.
 */
export function validateOverlaysConfig(
  config: AlignTrueConfig,
  align: Align,
): OverlayValidationResult {
  if (!config.overlays?.overrides || config.overlays.overrides.length === 0) {
    return { valid: true, warnings: [], raw: { valid: true } };
  }

  const overlays: OverlayDefinition[] = config.overlays.overrides;
  const limits: {
    maxOverrides?: number;
    maxOperationsPerOverride?: number;
  } = {};

  if (config.overlays.limits?.max_overrides !== undefined) {
    limits.maxOverrides = config.overlays.limits.max_overrides;
  }
  if (config.overlays.limits?.max_operations_per_override !== undefined) {
    limits.maxOperationsPerOverride =
      config.overlays.limits.max_operations_per_override;
  }

  const overlayResult = validateOverlays(overlays, align, limits);
  const warnings = (overlayResult.warnings || []).map((w) => w.message);
  return {
    valid: overlayResult.valid,
    warnings,
    errors: overlayResult.errors,
    raw: overlayResult,
  };
}
