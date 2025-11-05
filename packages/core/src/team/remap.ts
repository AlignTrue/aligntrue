/**
 * Severity remapping for team mode
 *
 * Allows teams to adjust rule severity levels (MUST/SHOULD/MAY → error/warn/note)
 * with guardrails to prevent policy regressions without rationale.
 */

import { existsSync, readFileSync } from "fs";
import { load as parseYaml } from "js-yaml";
import { join } from "path";

/**
 * Severity levels from Align IR (RFC 2119)
 */
export type AlignSeverity = "MUST" | "SHOULD" | "MAY";

/**
 * Check/validation severity levels (matches Finding.severity in checks package)
 */
export type CheckSeverity = "error" | "warn" | "info";

/**
 * Individual severity remap rule
 */
export interface SeverityRemap {
  rule_id: string;
  from: AlignSeverity;
  to: CheckSeverity;
  rationale_file?: string; // Required when lowering MUST below warn
}

/**
 * Team YAML configuration structure
 */
export interface TeamYaml {
  severity_remaps: SeverityRemap[];
}

/**
 * Validation error for remap configuration
 */
export interface RemapValidationError {
  rule_id: string;
  error: string;
  suggestion?: string;
}

/**
 * Parse .aligntrue.team.yaml file
 *
 * @param path - Path to team.yaml file
 * @returns Parsed team configuration
 * @throws Error if file cannot be parsed
 */
export function parseTeamYaml(path: string): TeamYaml {
  if (!existsSync(path)) {
    throw new Error(`Team configuration not found at ${path}`);
  }

  const content = readFileSync(path, "utf-8");
  let parsed: unknown;

  try {
    parsed = parseYaml(content);
  } catch (_err) {
    throw new Error(
      `Failed to parse team YAML: ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // Handle empty file (parsed as null by js-yaml)
  if (!parsed) {
    return { severity_remaps: [] };
  }

  // Validate basic structure
  if (typeof parsed !== "object") {
    throw new Error("Team YAML must be an object");
  }

  const obj = parsed as Record<string, unknown>;

  // severity_remaps is optional but must be array if present
  if (obj["severity_remaps"] !== undefined) {
    if (!Array.isArray(obj["severity_remaps"])) {
      throw new Error("severity_remaps must be an array");
    }
  }

  // Normalize to ensure severity_remaps exists
  const teamYaml: TeamYaml = {
    severity_remaps: obj["severity_remaps"] || [],
  };

  // Validate each remap entry
  for (let i = 0; i < teamYaml.severity_remaps.length; i++) {
    const remap = teamYaml.severity_remaps[i];

    if (!remap || typeof remap !== "object") {
      throw new Error(`severity_remaps[${i}] must be an object`);
    }

    if (typeof remap.rule_id !== "string" || !remap.rule_id) {
      throw new Error(
        `severity_remaps[${i}].rule_id is required and must be a string`,
      );
    }

    if (!["MUST", "SHOULD", "MAY"].includes(remap.from)) {
      throw new Error(
        `severity_remaps[${i}].from must be one of: MUST, SHOULD, MAY`,
      );
    }

    if (!["error", "warn", "info"].includes(remap.to)) {
      throw new Error(
        `severity_remaps[${i}].to must be one of: error, warn, info`,
      );
    }

    if (
      remap.rationale_file !== undefined &&
      typeof remap.rationale_file !== "string"
    ) {
      throw new Error(
        `severity_remaps[${i}].rationale_file must be a string if provided`,
      );
    }
  }

  return teamYaml;
}

/**
 * Validate severity remaps against guardrails
 *
 * Guardrail: Lowering MUST to "note" requires rationale_file that exists
 *
 * @param remaps - Array of severity remaps to validate
 * @param basePath - Base directory for resolving rationale file paths
 * @returns Array of validation errors (empty if valid)
 */
export function validateRemaps(
  remaps: SeverityRemap[],
  basePath: string = ".",
): RemapValidationError[] {
  const errors: RemapValidationError[] = [];

  for (const remap of remaps) {
    // Guardrail: MUST → info requires rationale
    if (remap.from === "MUST" && remap.to === "info") {
      if (!remap.rationale_file) {
        errors.push({
          rule_id: remap.rule_id,
          error: "Lowering MUST to info requires rationale_file",
          suggestion: `Add rationale_file field with path to RATIONALE.md explaining the policy regression`,
        });
        continue;
      }

      // Check if rationale file exists
      const rationaleFullPath = join(basePath, remap.rationale_file);
      if (!existsSync(rationaleFullPath)) {
        errors.push({
          rule_id: remap.rule_id,
          error: `Rationale file not found: ${remap.rationale_file}`,
          suggestion: `Create ${remap.rationale_file} with explanation for lowering MUST requirement`,
        });
      }
    }
  }

  return errors;
}

/**
 * Check if a team.yaml file exists and is valid
 *
 * @param path - Path to team.yaml file
 * @returns true if file exists and is parseable
 */
export function hasValidTeamYaml(path: string): boolean {
  try {
    parseTeamYaml(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply severity remaps to a rule's severity
 *
 * @param ruleId - Rule identifier
 * @param originalSeverity - Original severity from Align IR
 * @param remaps - Array of severity remaps to apply
 * @returns Remapped severity or original if no remap found
 */
export function applySeverityRemap(
  ruleId: string,
  originalSeverity: AlignSeverity,
  remaps: SeverityRemap[],
): CheckSeverity {
  const remap = remaps.find(
    (r) => r.rule_id === ruleId && r.from === originalSeverity,
  );

  if (remap) {
    return remap.to;
  }

  // Default mapping if no remap found
  const defaultMapping: Record<AlignSeverity, CheckSeverity> = {
    MUST: "error",
    SHOULD: "warn",
    MAY: "info",
  };

  return defaultMapping[originalSeverity];
}
