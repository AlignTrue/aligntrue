/**
 * Check command - Validate rules and configuration
 * Non-interactive validation for CI/CD pipelines and pre-commit hooks
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { type AlignTrueConfig, ensureSectionsArray } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import { validateAlignSchema } from "@aligntrue/schema";
import {
  readLockfile,
  validateLockfile,
  validateOverlays,
  formatOverlayValidationResult,
  type OverlayDefinition,
} from "@aligntrue/core";
import { parseYamlToJson } from "@aligntrue/schema";
import { tryLoadConfig } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { resolveSource } from "../utils/source-resolver.js";
import { getInvalidExporters } from "../utils/exporter-validation.js";
import { createSpinner } from "../utils/spinner.js";

/**
 * Argument definitions for check command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--ci",
    hasValue: false,
    description:
      "CI mode (REQUIRED - strict validation, non-zero exit on errors)",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--json",
    hasValue: false,
    description: "Output validation results in JSON format",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Check command implementation
 */
export async function check(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (parsed.help) {
    showStandardHelp({
      name: "check",
      description: "Validate rules and configuration (non-interactive)",
      usage: "aligntrue check --ci [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue check --ci",
        "aligntrue check --ci --config .aligntrue/config.yaml",
        "aligntrue check --ci --json",
      ],
      notes: [
        "Note: The --ci flag is REQUIRED for all check operations.",
        "",
        "Difference from 'drift':",
        "  check --ci     Validates schema + lockfile (internal consistency)",
        "  drift --gates  Detects source or agent file drift (team mode)",
        "",
        "Exit Codes:",
        "  0  All validations passed",
        "  1  Validation failed (schema, lockfile, or overlay errors)",
        "  2  System error (missing files, invalid config)",
      ],
    });
    return;
  }

  // Extract flags
  const ci = (parsed.flags["ci"] as boolean | undefined) || false;
  const jsonOutput = (parsed.flags["json"] as boolean | undefined) || false;
  const configPath =
    (parsed.flags["config"] as string | undefined) || ".aligntrue/config.yaml";

  // CI mode is required for now (other modes deferred)
  if (!ci) {
    showStandardHelp({
      name: "check",
      description: "Validate rules and configuration (non-interactive)",
      usage: "aligntrue check --ci [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue check --ci",
        "aligntrue check --ci --config .aligntrue/config.yaml",
        "aligntrue check --ci --json",
      ],
      notes: [
        "Note: The --ci flag is REQUIRED for all check operations.",
        "",
        "Difference from 'drift':",
        "  check --ci     Validates schema + lockfile (internal consistency)",
        "  drift --gates  Detects source or agent file drift (team mode)",
        "",
        "Exit Codes:",
        "  0  All validations passed",
        "  1  Validation failed (schema, lockfile, or overlay errors)",
        "  2  System error (missing files, invalid config)",
      ],
    });
    console.error("Error: --ci flag is required\n");
    console.error("Run: aligntrue check --ci\n");
    process.exit(2);
  }

  const spinner = createSpinner();
  spinner.start("Validating AlignTrue rules");
  let spinnerActive = true;
  const stopSpinner = (text: string): void => {
    if (spinnerActive) {
      spinner.stop(text);
      spinnerActive = false;
    }
  };

  try {
    // Step 1: Load config (with standardized error handling)
    const config: AlignTrueConfig = await tryLoadConfig(configPath);

    let invalidExporters;
    try {
      invalidExporters = await getInvalidExporters(config.exporters);
    } catch (_error) {
      const message = _error instanceof Error ? _error.message : String(_error);
      if (jsonOutput) {
        stopSpinner("Validation failed");
        console.log(
          JSON.stringify(
            {
              valid: false,
              error: `Failed to validate exporters: ${message}`,
            },
            null,
            2,
          ),
        );
        process.exit(2);
      }

      stopSpinner("Validation failed");
      exitWithError(
        Errors.validationFailed([
          `Failed to validate exporters: ${message}`,
          "Reinstall AlignTrue or run 'pnpm build' to regenerate exporters.",
        ]),
        2,
      );
    }

    if (invalidExporters && invalidExporters.length > 0) {
      const details = invalidExporters.map((issue) =>
        issue.suggestion
          ? `Unknown exporter "${issue.name}" (did you mean "${issue.suggestion}"?)`
          : `Unknown exporter "${issue.name}"`,
      );

      if (jsonOutput) {
        stopSpinner("Validation failed");
        console.log(
          JSON.stringify(
            {
              valid: false,
              errors: details,
              code: "ERR_CONFIG_VALIDATION_FAILED",
            },
            null,
            2,
          ),
        );
        process.exit(1);
      }

      stopSpinner("Validation failed");
      exitWithError(
        {
          ...Errors.configValidationFailed(configPath, details),
          hint: "Run 'aligntrue adapters list' to view available exporters, then update .aligntrue/config.yaml",
        },
        1,
      );
    }

    // Step 2: Resolve source (local or git)
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/.rules.yaml",
    };

    let rulesContent: string;
    let rulesPath: string;

    try {
      const resolved = await resolveSource(source);
      rulesContent = resolved.content;
      rulesPath = resolved.sourcePath;
    } catch (err) {
      stopSpinner("Validation failed");
      exitWithError(
        Errors.fileWriteFailed(
          source.type === "local"
            ? source.path || "unknown"
            : source.url || "unknown",
          err instanceof Error ? err.message : String(err),
        ),
        2,
      );
    }

    // Detect file format and parse
    const ext =
      rulesPath.endsWith(".md") || rulesPath.endsWith(".markdown")
        ? ".md"
        : ".yaml";
    let alignData: unknown;

    if (ext === ".md") {
      // Parse as natural markdown
      const { parseNaturalMarkdown } = await import(
        "@aligntrue/core/parsing/natural-markdown"
      );
      const parseResult = parseNaturalMarkdown(rulesContent);

      if (parseResult.errors.length > 0) {
        stopSpinner("Validation failed");
        const errorList = parseResult.errors
          .map((err) => `  Line ${err.line}: ${err.message}`)
          .join("\n");
        console.error("✗ Markdown validation errors\n");
        console.error(errorList + "\n");
        process.exit(1);
      }

      if (parseResult.sections.length === 0) {
        stopSpinner("Validation failed");
        console.error("✗ No sections found in markdown\n");
        console.error(`  File: ${rulesPath}\n`);
        process.exit(1);
      }

      alignData = {
        id: parseResult.metadata.id || "unnamed",
        version: parseResult.metadata.version || "1.0.0",
        spec_version: "1",
        sections: parseResult.sections,
        ...parseResult.metadata,
      };
    } else {
      // Parse as YAML
      try {
        alignData = parseYamlToJson(rulesContent);

        // Handle edge cases: empty YAML returns undefined, comments-only returns null
        if (alignData === undefined || alignData === null) {
          stopSpinner("Validation failed");
          console.error("✗ Empty or invalid rules file\n");
          console.error(`  File: ${rulesPath}`);
          console.error(
            `  The rules file must contain a valid Align pack (id, version, spec_version, rules)\n`,
          );
          console.error(
            "  Run 'aligntrue init' to create a valid rules file\n",
          );
          process.exit(1);
        }

        // Verify it's actually an object (not a string, array, or primitive)
        if (typeof alignData !== "object" || Array.isArray(alignData)) {
          stopSpinner("Validation failed");
          console.error("✗ Invalid rules file structure\n");
          console.error(`  File: ${rulesPath}`);
          console.error(
            `  Expected: YAML object with id, version, spec_version, rules or sections`,
          );
          console.error(
            `  Got: ${typeof alignData}${Array.isArray(alignData) ? " (array)" : ""}\n`,
          );
          console.error(
            "  Run 'aligntrue init' to create a valid rules file\n",
          );
          process.exit(1);
        }
      } catch (_err) {
        stopSpinner("Validation failed");
        console.error("✗ Invalid YAML in rules file\n");
        console.error(
          `  ${_err instanceof Error ? _err.message : String(_err)}\n`,
        );
        console.error(`  Check for syntax errors in ${rulesPath}\n`);
        process.exit(1);
      }
    }

    // Defensive: Ensure sections array exists (for backward compatibility)
    // This must be done BEFORE validation since schema requires sections
    const pack = alignData as AlignPack;
    ensureSectionsArray(pack);

    // Validate against schema
    const schemaResult = validateAlignSchema(pack);
    if (!schemaResult.valid) {
      const details = (schemaResult.errors || []).map(
        (err) => `${err.path}: ${err.message}`,
      );
      stopSpinner("Validation failed");
      exitWithError(
        {
          ...Errors.validationFailed(details),
          message: `Errors in ${rulesPath}`,
          hint: "Open the file above, fix the invalid sections, then run 'aligntrue sync' followed by 'aligntrue check --ci'",
        },
        1,
      );
    }

    // Step 2.5: Validate section IDs (rules field no longer used - sections only)
    // Section validation happens at parse time in markdown parser
    // In sections-only format, validation happens at parse time
    // No additional ID validation needed here

    // Step 3: Validate lockfile if team mode + lockfile enabled
    const shouldCheckLockfile =
      config.mode === "team" && config.modules?.lockfile === true;

    if (shouldCheckLockfile) {
      const lockfilePath = resolve(".aligntrue.lock.json");

      // Check if lockfile exists
      if (!existsSync(lockfilePath)) {
        stopSpinner("Validation failed");
        console.error("✗ Lockfile validation failed\n");
        console.error("  Lockfile not found (required in team mode)");
        console.error(`  Expected: ${lockfilePath}\n`);
        console.error(`  Run 'aligntrue sync' to generate the lockfile.\n`);
        process.exit(1);
      }

      // Load and validate lockfile
      try {
        const lockfile = readLockfile(lockfilePath);
        if (!lockfile) {
          stopSpinner("Validation failed");
          console.error("✗ Lockfile validation failed\n");
          console.error("  Failed to read lockfile\n");
          process.exit(2);
        }
        const validation = validateLockfile(lockfile, alignData as AlignPack);

        if (!validation.valid) {
          stopSpinner("Validation failed");
          console.error("✗ Lockfile drift detected\n");

          // Show mismatches
          if (validation.mismatches && validation.mismatches.length > 0) {
            console.error("  Hash mismatches:");
            for (const mismatch of validation.mismatches) {
              console.error(`    - ${mismatch.rule_id}`);
              console.error(`      Expected: ${mismatch.expected_hash}`);
              console.error(`      Actual:   ${mismatch.actual_hash}`);
            }
          }

          // Show new rules
          if (validation.newRules && validation.newRules.length > 0) {
            console.error(
              `\n  New rules not in lockfile: ${validation.newRules.join(", ")}`,
            );
          }

          // Show deleted rules
          if (validation.deletedRules && validation.deletedRules.length > 0) {
            console.error(
              `\n  Rules in lockfile but not in IR: ${validation.deletedRules.join(", ")}`,
            );
          }

          console.error(`\n  Run 'aligntrue sync' to update the lockfile.\n`);
          process.exit(1);
        }
      } catch (_err) {
        stopSpinner("Validation failed");
        console.error("✗ Lockfile validation failed\n");
        console.error(
          `  ${_err instanceof Error ? _err.message : String(_err)}\n`,
        );
        process.exit(2);
      }
    }

    // Step 4: Validate overlays if present
    let overlayWarnings: string[] = [];

    if (config.overlays?.overrides && config.overlays.overrides.length > 0) {
      const overlays: OverlayDefinition[] = config.overlays.overrides;
      // TypeScript strict mode: only pass defined values
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

      const overlayResult = validateOverlays(
        overlays,
        alignData as AlignPack,
        limits,
      );

      if (!overlayResult.valid) {
        if (jsonOutput) {
          // JSON output mode
          stopSpinner("Validation failed");
          console.log(
            JSON.stringify(
              {
                valid: false,
                errors: overlayResult.errors,
                warnings: overlayResult.warnings,
              },
              null,
              2,
            ),
          );
        } else {
          // Human-readable output
          stopSpinner("Validation failed");
          console.error("✗ Overlay validation failed\n");
          console.error(formatOverlayValidationResult(overlayResult));
          console.error("");
        }

        process.exit(1);
      }

      if (overlayResult.warnings && overlayResult.warnings.length > 0) {
        overlayWarnings = overlayResult.warnings.map((w) => w.message);
      }
    }

    // Step 5: All validations passed
    stopSpinner("Validation complete");

    if (jsonOutput) {
      // JSON output mode
      const result: {
        valid: boolean;
        schema: { valid: boolean; file: string };
        lockfile?: { valid: boolean; file: string };
        overlays?: {
          valid: boolean;
          count: number;
          warnings: string[];
        };
      } = {
        valid: true,
        schema: { valid: true, file: rulesPath },
      };

      if (shouldCheckLockfile) {
        result.lockfile = {
          valid: true,
          file: ".aligntrue.lock.json",
        };
      }

      if (config.overlays?.overrides && config.overlays.overrides.length > 0) {
        result.overlays = {
          valid: true,
          count: config.overlays.overrides.length,
          warnings: overlayWarnings,
        };
      }

      console.log(JSON.stringify(result, null, 2));
    } else {
      // Human-readable output
      console.log("✓ Validation passed\n");
      console.log(`  Schema: ${rulesPath} is valid`);

      if (shouldCheckLockfile) {
        console.log("  Lockfile: .aligntrue.lock.json matches current rules");
      } else if (config.mode === "solo") {
        console.log("  Lockfile: skipped (solo mode)");
      }

      if (config.overlays?.overrides && config.overlays.overrides.length > 0) {
        console.log(
          `  Overlays: ${config.overlays.overrides.length} overlay(s) validated`,
        );
        if (overlayWarnings.length > 0) {
          console.log(`    Warnings: ${overlayWarnings.length}`);
          for (const warning of overlayWarnings) {
            console.log(`      - ${warning}`);
          }
        }
      }

      console.log("");
    }
  } catch (err) {
    stopSpinner("Validation failed");
    if (err instanceof Error && err.name === "ProcessExitError") {
      throw err;
    }
    // Unexpected system error
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            valid: false,
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
      );
    } else {
      console.error("✗ System error\n");
      console.error(`  ${err instanceof Error ? err.message : String(err)}\n`);
    }
    process.exit(2);
  }
}
