/**
 * Team mode validation
 * Enforces invariants for team mode configuration
 */

import type { AlignTrueConfig } from "../config/index.js";
import { ValidationResult, valid } from "./framework.js";

/**
 * Validate team mode configuration
 */
export function validateTeamMode(config: AlignTrueConfig): ValidationResult {
  // Only validate if in team mode
  if (config.mode !== "team") {
    return valid();
  }

  // Team mode validation passes - storage/resources system removed
  // Future: add team-specific validation as needed
  return valid();
}
