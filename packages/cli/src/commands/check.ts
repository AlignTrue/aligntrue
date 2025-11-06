/**
 * Check command - Validate rules and configuration
 * Non-interactive validation for CI/CD pipelines and pre-commit hooks
 */

import { existsSync } from "fs";
import { resolve, extname } from "path";
import { type AlignTrueConfig } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import { validateAlignSchema } from "@aligntrue/schema";
import { readFileSync } from "fs";
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

  try {
    // Step 1: Load config (with standardized error handling)
    const config: AlignTrueConfig = await tryLoadConfig(configPath);

    // Step 2: Validate IR schema
    const rulesPath = config.sources?.[0]?.path || ".aligntrue/.rules.yaml";
    const resolvedRulesPath = resolve(rulesPath);

    if (!existsSync(resolvedRulesPath)) {
      exitWithError(
        {
          ...Errors.rulesNotFound(rulesPath),
          details: [`Expected: ${rulesPath}`, `Resolved: ${resolvedRulesPath}`],
        },
        2,
      );
    }

    // Load and parse rules file
    let rulesContent: string;
    try {
      rulesContent = readFileSync(resolvedRulesPath, "utf8");
    } catch (err) {
      exitWithError(
        Errors.fileWriteFailed(
          resolvedRulesPath,
          err instanceof Error ? err.message : String(err),
        ),
        2,
      );
    }

    // Detect file format and parse
    const ext = extname(resolvedRulesPath).toLowerCase();
    let alignData: unknown;

    if (ext === ".md" || ext === ".markdown") {
      // Parse markdown with fenced blocks
      const { parseMarkdown, buildIR } = await import(
        "@aligntrue/markdown-parser"
      );
      const parseResult = parseMarkdown(rulesContent);

      if (parseResult.errors.length > 0) {
        const errorList = parseResult.errors
          .map((err) => `  Line ${err.line}: ${err.message}`)
          .join("\n");
        console.error("✗ Invalid markdown structure\n");
        console.error(errorList + "\n");
        process.exit(1);
      }

      const buildResult = buildIR(parseResult.blocks);

      if (buildResult.errors.length > 0) {
        const errorList = buildResult.errors
          .map((err) => `  Line ${err.line}: ${err.message}`)
          .join("\n");
        console.error("✗ IR build errors\n");
        console.error(errorList + "\n");
        console.error(`  Check for syntax errors in ${rulesPath}\n`);
        process.exit(1);
      }

      if (!buildResult.document) {
        console.error("✗ Failed to build IR from markdown\n");
        console.error(`  No aligntrue blocks found in ${rulesPath}\n`);
        process.exit(1);
      }

      alignData = buildResult.document;
    } else {
      // Parse as YAML
      try {
        alignData = parseYamlToJson(rulesContent);
      } catch (_err) {
        console.error("✗ Invalid YAML in rules file\n");
        console.error(
          `  ${_err instanceof Error ? _err.message : String(_err)}\n`,
        );
        console.error(`  Check for syntax errors in ${rulesPath}\n`);
        process.exit(1);
      }
    }

    // Validate against schema
    const schemaResult = validateAlignSchema(alignData);
    if (!schemaResult.valid) {
      const details = (schemaResult.errors || []).map(
        (err) => `${err.path}: ${err.message}`,
      );
      exitWithError(
        {
          ...Errors.validationFailed(details),
          message: `Errors in ${rulesPath}`,
          hint: "Fix the errors above and run 'aligntrue check --ci' again",
        },
        1,
      );
    }

    // Step 2.5: Validate rule IDs
    const { validateRuleId } = await import("@aligntrue/schema");
    const alignPack = alignData as AlignPack;

    for (const rule of alignPack.rules || []) {
      const validation = validateRuleId(rule.id);
      if (!validation.valid) {
        console.error("✗ Invalid rule ID\n");
        console.error(`  Rule: ${rule.id}`);
        console.error(`  Error: ${validation.error}`);
        if (validation.suggestion) {
          console.error(`  ${validation.suggestion}`);
        }
        console.error(
          `\n  Fix the rule ID and run 'aligntrue check --ci' again.\n`,
        );
        process.exit(1);
      }
    }

    // Step 3: Validate lockfile if team mode + lockfile enabled
    let _lockfileValid = true;
    const shouldCheckLockfile =
      config.mode === "team" && config.modules?.lockfile === true;

    if (shouldCheckLockfile) {
      const lockfilePath = resolve(".aligntrue.lock.json");

      // Check if lockfile exists
      if (!existsSync(lockfilePath)) {
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
          console.error("✗ Lockfile validation failed\n");
          console.error("  Failed to read lockfile\n");
          process.exit(2);
        }
        const validation = validateLockfile(lockfile, alignData as AlignPack);

        if (!validation.valid) {
          _lockfileValid = false;
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
        console.error("✗ Lockfile validation failed\n");
        console.error(
          `  ${_err instanceof Error ? _err.message : String(_err)}\n`,
        );
        process.exit(2);
      }
    }

    // Step 4: Validate overlays if present
    let _overlayValid = true;
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
        _overlayValid = false;

        if (jsonOutput) {
          // JSON output mode
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
