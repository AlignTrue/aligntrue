/**
 * Check command - Validate rules and configuration
 * Non-interactive validation for CI/CD pipelines and pre-commit hooks
 */

import {
  ensureSectionsArray,
  getExporterNames,
  formatOverlayValidationResult,
} from "@aligntrue/core";
import type { AlignTrueConfig } from "@aligntrue/core";
import type { Align } from "@aligntrue/schema";
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
import { createManagedSpinner } from "../utils/spinner.js";
import { validateSchema } from "./check/schema-validator.js";
import { validateLockfileForCheck } from "./check/lockfile-validator.js";
import { validateOverlaysConfig } from "./check/overlay-validator.js";

/**
 * Argument definitions for check command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--ci",
    hasValue: false,
    description: "CI mode (disables interactive spinner/output)",
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
      usage: "aligntrue check [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue check",
        "aligntrue check --config .aligntrue/config.yaml",
        "aligntrue check --ci --json",
      ],
      notes: [
        "--ci disables interactive spinner/output for CI pipelines.",
        "",
        "Difference from 'drift':",
        "  check          Validates schema + lockfile (internal consistency)",
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
  const ciFlag = Boolean(parsed.flags["ci"]);
  const jsonOutput = (parsed.flags["json"] as boolean | undefined) || false;
  const configPath =
    (parsed.flags["config"] as string | undefined) || ".aligntrue/config.yaml";
  const envCiValue = process.env["CI"];
  const envCi =
    typeof envCiValue === "string" &&
    envCiValue.length > 0 &&
    envCiValue.toLowerCase() !== "false" &&
    envCiValue !== "0";
  const ciMode = ciFlag || envCi;

  const spinner = createManagedSpinner({ disabled: ciMode || jsonOutput });
  spinner.start("Validating AlignTrue rules");

  try {
    // Step 1: Load config (with standardized error handling)
    let config: AlignTrueConfig;
    try {
      config = await tryLoadConfig(configPath);
    } catch (_error) {
      const message =
        _error instanceof Error ? _error.message : String(_error ?? "");

      spinner.stop("Validation failed");

      if (message.toLowerCase().includes("config file not found")) {
        exitWithError(Errors.configNotFound(configPath), 2);
      }

      exitWithError(Errors.operationFailed("Load config", message), 2);
    }

    let invalidExporters;
    try {
      invalidExporters = await getInvalidExporters(
        getExporterNames(config.exporters),
      );
    } catch (_error) {
      const message = _error instanceof Error ? _error.message : String(_error);
      if (jsonOutput) {
        spinner.stop("Validation failed");
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
        process.exitCode = 2;
        return;
      }

      spinner.stop("Validation failed");
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
        spinner.stop("Validation failed");
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
        process.exitCode = 1;
        return;
      }

      spinner.stop("Validation failed");
      exitWithError(
        {
          ...Errors.configValidationFailed(configPath, details),
          hint: "Run 'aligntrue exporters list' to view available exporters, then update .aligntrue/config.yaml",
        },
        1,
      );
    }

    // Step 2: Resolve source (local or git)
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/rules",
    };

    let align: Align;
    let rulesPath: string;

    try {
      const resolved = await resolveSource(source);
      align = resolved.align;
      rulesPath = resolved.sourcePath;
    } catch (err) {
      spinner.stop("Validation failed");
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

    // Defensive: Ensure sections array exists (for backward compatibility)
    // This must be done BEFORE validation since schema requires sections
    ensureSectionsArray(align);

    const schemaResult = validateSchema(align);
    if (!schemaResult.valid) {
      spinner.stop("Validation failed");
      exitWithError(
        {
          ...Errors.validationFailed(schemaResult.errors || []),
          message: `Errors in ${rulesPath}`,
          hint: "Open the file above, fix the invalid sections, then run 'aligntrue sync' followed by 'aligntrue check'",
        },
        1,
      );
    }

    // Step 2.5: Validate section IDs (rules field no longer used - sections only)
    // Section validation happens at parse time in markdown parser
    // In sections-only format, validation happens at parse time
    // No additional ID validation needed here

    // Step 3: Validate lockfile if team mode + lockfile enabled
    const lockfileResult = await validateLockfileForCheck(
      config,
      process.cwd(),
    );
    const shouldCheckLockfile = lockfileResult.status !== "skipped";

    if (lockfileResult.status === "missing") {
      spinner.stop("Validation failed");
      console.error("✗ Lockfile validation failed\n");
      console.error("  Lockfile not found (required in team mode)");
      console.error(`  Expected: ${lockfileResult.lockfilePath}\n`);
      console.error(`  Run 'aligntrue sync' to generate the lockfile.\n`);
      process.exitCode = 1;
      return;
    }

    if (lockfileResult.status === "read_error") {
      spinner.stop("Validation failed");
      console.error("✗ Lockfile validation failed\n");
      console.error(`  ${lockfileResult.error}\n`);
      console.error(
        `  Try: rm ${lockfileResult.lockfilePath} && aligntrue sync\n`,
      );
      process.exitCode = 2;
      return;
    }

    if (lockfileResult.status === "mismatch") {
      spinner.stop("Validation failed");
      console.error("✗ Lockfile drift detected\n");
      console.error("  Bundle hash mismatch:");
      console.error(
        `    Expected: ${lockfileResult.expectedHash?.slice(0, 16)}...`,
      );
      console.error(
        `    Actual:   ${lockfileResult.actualHash?.slice(0, 16)}...`,
      );
      console.error(`\n  Run 'aligntrue sync' to update the lockfile.\n`);
      process.exitCode = 1;
      return;
    }

    // Step 4: Validate overlays if present
    let overlayWarnings: string[] = [];
    const overlayResult = validateOverlaysConfig(config, align);

    if (!overlayResult.valid) {
      if (jsonOutput) {
        spinner.stop("Validation failed");
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
        spinner.stop("Validation failed");
        console.error("✗ Overlay validation failed\n");
        const formatted = overlayResult.raw;
        console.error(formatOverlayValidationResult(formatted));
        console.error("");
      }

      process.exitCode = 1;
      return;
    }

    overlayWarnings = overlayResult.warnings;

    // Step 5: Check file organization (warnings only, non-blocking)
    const { validateFileOrganization } = await import(
      "./check/file-size-validator.js"
    );
    const fileOrgWarnings = await validateFileOrganization(
      config,
      process.cwd(),
    );

    // Step 6: All validations passed
    spinner.stop("Validation complete");

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
        fileOrganization?: {
          warnings: string[];
        };
      } = {
        valid: true,
        schema: { valid: true, file: rulesPath },
      };

      if (shouldCheckLockfile) {
        result.lockfile = {
          valid: true,
          file: ".aligntrue/lock.json",
        };
      }

      if (config.overlays?.overrides && config.overlays.overrides.length > 0) {
        result.overlays = {
          valid: true,
          count: config.overlays.overrides.length,
          warnings: overlayWarnings,
        };
      }

      if (fileOrgWarnings.length > 0) {
        result.fileOrganization = {
          warnings: fileOrgWarnings,
        };
      }

      console.log(JSON.stringify(result, null, 2));
    } else {
      // Human-readable output
      console.log("✓ Validation passed\n");
      console.log(`  Schema: ${rulesPath} is valid`);

      if (shouldCheckLockfile) {
        console.log("  Lockfile: .aligntrue/lock.json matches current rules");
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

      // Show file organization warnings
      if (fileOrgWarnings.length > 0) {
        console.log("\n💡 File organization recommendations:");
        for (const warning of fileOrgWarnings) {
          console.log(`  - ${warning}`);
        }
      }

      console.log("");
    }
  } catch (err) {
    spinner.stop("Validation failed");
    if (
      err instanceof Error &&
      (err.name === "ProcessExitError" ||
        err.message.toLowerCase().includes("process.exit"))
    ) {
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
      console.error("✗ Unexpected error\n");
      console.error(`  ${err instanceof Error ? err.message : String(err)}\n`);
      console.error(
        "  Try: aligntrue check --json for machine-readable output",
      );
      console.error("  If this persists, report with: aligntrue --version\n");
    }
    process.exitCode = 2;
  }
}
