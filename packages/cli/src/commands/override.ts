/**
 * Override command - Manage overlays for customizing upstream rules
 * Phase 3.5 Session 3: Full CLI implementation
 */

import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  loadConfig,
  saveConfig,
  findStaleSelectors,
  findAmbiguousSelectors,
  loadIR,
  applyOverlays,
  evaluateSelector,
  type OverlayDefinition,
} from "@aligntrue/core";
import { readFileSync, writeFileSync } from "fs";
import * as yaml from "js-yaml";

const HELP_TEXT = `
Usage: aln override <subcommand> [options]

Manage overlays for fork-safe customization of upstream rules.

Subcommands:
  add       Interactively create a new overlay
  status    Show current overlays and their health
  diff      Show before/after changes from overlays

Examples:
  aln override add             # Interactive overlay creation
  aln override status          # Show all overlays
  aln override status --json   # JSON output
  aln override diff            # Show changes from overlays
`.trim();

/**
 * Main override command router
 */
export async function overrideCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(HELP_TEXT);
    return;
  }

  const cwd = process.cwd();

  try {
    switch (subcommand) {
      case "add":
        await handleAdd(cwd, args.slice(1));
        break;

      case "status":
        await handleStatus(cwd, args.slice(1));
        break;

      case "diff":
        await handleDiff(cwd, args.slice(1));
        break;

      default:
        clack.log.error(`Unknown subcommand: ${subcommand}`);
        console.log(HELP_TEXT);
        process.exit(2);
    }
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Interactive overlay creation
 */
async function handleAdd(cwd: string, args: string[]): Promise<void> {
  const paths = getAlignTruePaths(cwd);

  // Load config and IR
  const config = await loadConfig();
  const ir = await loadIR(paths.rules, { mode: config.mode });

  if (!ir.rules || ir.rules.length === 0) {
    clack.log.error("No rules found in IR. Cannot create overlay.");
    process.exit(1);
  }

  clack.intro("Create overlay");

  // Step 1: Select rule
  const ruleChoices = ir.rules.map((rule, index) => ({
    value: rule.id,
    label: `${rule.id} - ${rule.description || "(no description)"}`,
    hint: rule.severity ? `severity: ${rule.severity}` : undefined,
  }));

  const selectedRuleId = (await clack.select({
    message: "Select rule to customize:",
    options: ruleChoices,
  })) as string;

  if (clack.isCancel(selectedRuleId)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const selector = `rule[id=${selectedRuleId}]`;

  // Validate selector
  const selectorResult = evaluateSelector(selector, ir);
  if (!selectorResult.success) {
    clack.log.error(`Selector validation failed: ${selectorResult.error}`);
    process.exit(1);
  }

  // Step 2: Choose operation type
  const operationType = (await clack.select({
    message: "What would you like to do?",
    options: [
      { value: "set", label: "Set/update properties" },
      { value: "remove", label: "Remove properties" },
      { value: "both", label: "Both set and remove" },
    ],
  })) as string;

  if (clack.isCancel(operationType)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const overlay: OverlayDefinition = { selector };

  // Step 3: Collect set operations
  if (operationType === "set" || operationType === "both") {
    const setOpsInput = (await clack.text({
      message:
        "Properties to set (format: key=value, key2=value2, or use dot notation like 'check.inputs.pattern=/src/'):",
      placeholder: "severity=critical, enabled=true",
    })) as string;

    if (clack.isCancel(setOpsInput)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    if (setOpsInput.trim()) {
      overlay.set = parseSetOperations(setOpsInput);
    }
  }

  // Step 4: Collect remove operations
  if (operationType === "remove" || operationType === "both") {
    const removeOpsInput = (await clack.text({
      message: "Properties to remove (comma-separated):",
      placeholder: "enabled, deprecated_field",
    })) as string;

    if (clack.isCancel(removeOpsInput)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    if (removeOpsInput.trim()) {
      overlay.remove = removeOpsInput
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
  }

  // Step 5: Preview
  const previewResult = applyOverlays(ir, [overlay]);
  if (!previewResult.success) {
    clack.log.error(
      `Preview failed: ${previewResult.errors?.join(", ") || "Unknown error"}`,
    );
    process.exit(1);
  }

  console.log("\nPreview:");
  console.log(`  Selector: ${overlay.selector}`);
  if (overlay.set) {
    console.log(
      `  Set: ${Object.keys(overlay.set)
        .map((k) => `${k}=${JSON.stringify(overlay.set![k])}`)
        .join(", ")}`,
    );
  }
  if (overlay.remove) {
    console.log(`  Remove: ${overlay.remove.join(", ")}`);
  }

  if (previewResult.warnings && previewResult.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of previewResult.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
  }

  // Step 6: Confirm
  const confirmed = await clack.confirm({
    message: "Add this overlay to config?",
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  // Step 7: Update config file
  if (!config.overlays) {
    config.overlays = {};
  }
  if (!config.overlays.overrides) {
    config.overlays.overrides = [];
  }
  config.overlays.overrides.push(overlay);

  await saveConfig(config, paths.config);

  clack.outro("✓ Overlay added successfully");
}

/**
 * Parse set operations from user input
 * Format: "key=value, key2=value2" or "key=value,key2=value2"
 */
function parseSetOperations(input: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Split by comma, handling potential commas in values
  const pairs = input.split(/,(?=\s*\w+\s*=)/).map((s) => s.trim());

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;

    const key = pair.slice(0, eqIndex).trim();
    const valueStr = pair.slice(eqIndex + 1).trim();

    if (!key) continue;

    // Try to parse as JSON first (for booleans, numbers, arrays)
    try {
      result[key] = JSON.parse(valueStr);
    } catch {
      // If JSON parsing fails, treat as string
      result[key] = valueStr;
    }
  }

  return result;
}

/**
 * Show overlay status with health indicators
 */
async function handleStatus(cwd: string, args: string[]): Promise<void> {
  const jsonOutput = args.includes("--json");
  const paths = getAlignTruePaths(cwd);

  // Load config
  const config = await loadConfig();

  if (!config.overlays?.overrides || config.overlays.overrides.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ overlays: [], count: 0 }, null, 2));
    } else {
      console.log("No overlays configured.");
      console.log(
        "\nTo add overlays, run: aln override add\nOr edit .aligntrue/config.yaml",
      );
    }
    return;
  }

  // Load IR to check overlay health
  let ir;
  try {
    ir = await loadIR(paths.rules, { mode: config.mode });
  } catch {
    // IR not available - show overlays without health check
    ir = null;
  }

  const overlays = config.overlays.overrides;
  const staleSelectors = ir
    ? findStaleSelectors(
        overlays.map((o) => o.selector),
        ir,
      )
    : [];
  const ambiguousSelectors = ir
    ? findAmbiguousSelectors(
        overlays.map((o) => o.selector),
        ir,
      )
    : [];

  // Check size limits
  const limits = config.overlays.limits || {
    max_overrides: 50,
    max_operations_per_override: 20,
  };
  const approachingLimit = overlays.length > limits.max_overrides! * 0.8;

  // JSON output
  if (jsonOutput) {
    const output = {
      overlays: overlays.map((overlay) => {
        const isStale = staleSelectors.includes(overlay.selector);
        const isAmbiguous = ambiguousSelectors.some(
          (a) => a.selector === overlay.selector,
        );
        const setCount = overlay.set ? Object.keys(overlay.set).length : 0;
        const removeCount = overlay.remove ? overlay.remove.length : 0;
        const totalOps = setCount + removeCount;

        return {
          selector: overlay.selector,
          operations: { set: setCount, remove: removeCount, total: totalOps },
          health: isStale
            ? "stale"
            : isAmbiguous
              ? "ambiguous"
              : totalOps > limits.max_operations_per_override!
                ? "over_limit"
                : "ok",
        };
      }),
      count: overlays.length,
      limits: {
        max_overrides: limits.max_overrides,
        max_operations_per_override: limits.max_operations_per_override,
      },
      warnings: {
        stale: staleSelectors.length,
        ambiguous: ambiguousSelectors.length,
        approaching_limit: approachingLimit,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  console.log(
    `\n📦 Overlays: ${overlays.length}/${limits.max_overrides} configured\n`,
  );

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    if (!overlay) continue;

    const isStale = staleSelectors.includes(overlay.selector);
    const isAmbiguous = ambiguousSelectors.some(
      (a) => a.selector === overlay.selector,
    );
    const setCount = overlay.set ? Object.keys(overlay.set).length : 0;
    const removeCount = overlay.remove ? overlay.remove.length : 0;
    const totalOps = setCount + removeCount;
    const overLimit = totalOps > limits.max_operations_per_override!;

    const statusIcon = isStale || isAmbiguous || overLimit ? "⚠️ " : "✓";
    const healthLabels = [];
    if (isStale) healthLabels.push("stale");
    if (isAmbiguous) healthLabels.push("ambiguous");
    if (overLimit) healthLabels.push("over limit");
    const statusLabel =
      healthLabels.length > 0 ? `(${healthLabels.join(", ")})` : "(ok)";

    console.log(`${i + 1}. ${statusIcon} ${overlay.selector} ${statusLabel}`);

    if (overlay.set) {
      console.log(`   Set: ${Object.keys(overlay.set).join(", ")}`);
    }
    if (overlay.remove) {
      console.log(`   Remove: ${overlay.remove.join(", ")}`);
    }
    console.log();
  }

  // Summary warnings
  const warnings: string[] = [];
  if (staleSelectors.length > 0) {
    warnings.push(
      `⚠️  ${staleSelectors.length} stale selector(s) - these don't match current IR`,
    );
  }
  if (ambiguousSelectors.length > 0) {
    warnings.push(
      `⚠️  ${ambiguousSelectors.length} ambiguous selector(s) - these match multiple rules`,
    );
  }
  if (approachingLimit) {
    warnings.push(
      `⚠️  Approaching overlay limit: ${overlays.length}/${limits.max_overrides} (consider splitting)`,
    );
  }

  if (warnings.length > 0) {
    console.log(warnings.join("\n"));
    console.log();
  }
}

/**
 * Show before/after diff from overlays
 */
async function handleDiff(cwd: string, args: string[]): Promise<void> {
  const paths = getAlignTruePaths(cwd);

  // Load config
  const config = await loadConfig();

  if (!config.overlays?.overrides || config.overlays.overrides.length === 0) {
    console.log("No overlays configured. Nothing to diff.");
    console.log("\nTo add overlays, run: aln override add");
    return;
  }

  // Load IR
  const ir = await loadIR(paths.rules, { mode: config.mode });

  // Apply overlays
  const result = applyOverlays(
    ir,
    config.overlays.overrides,
    config.overlays.limits,
  );

  if (!result.success) {
    clack.log.error(
      `Failed to apply overlays: ${result.errors?.join(", ") || "Unknown error"}`,
    );
    process.exit(1);
  }

  console.log("\n📋 Overlay diff:\n");
  console.log(`Applied ${result.appliedCount} overlay(s)\n`);

  // Show affected rules
  const affectedRules = new Set<string>();
  for (const overlay of config.overlays.overrides) {
    if (overlay.selector.startsWith("rule[id=")) {
      const match = overlay.selector.match(/rule\[id=([^\]]+)\]/);
      if (match) {
        affectedRules.add(match[1]);
      }
    }
  }

  if (affectedRules.size > 0) {
    console.log("Affected rules:");
    for (const ruleId of Array.from(affectedRules).sort()) {
      const originalRule = ir.rules?.find((r) => r.id === ruleId);
      const modifiedRule = result.modifiedIR?.rules?.find(
        (r: any) => r.id === ruleId,
      );

      if (!originalRule || !modifiedRule) continue;

      console.log(`\n  ${ruleId}:`);

      // Show property changes
      const allKeys = new Set([
        ...Object.keys(originalRule),
        ...Object.keys(modifiedRule),
      ]);

      for (const key of Array.from(allKeys).sort()) {
        const origValue = (originalRule as any)[key];
        const modValue = (modifiedRule as any)[key];

        if (JSON.stringify(origValue) !== JSON.stringify(modValue)) {
          if (origValue === undefined) {
            console.log(`    + ${key}: ${JSON.stringify(modValue)}`);
          } else if (modValue === undefined) {
            console.log(`    - ${key}: ${JSON.stringify(origValue)}`);
          } else {
            console.log(
              `    ~ ${key}: ${JSON.stringify(origValue)} → ${JSON.stringify(modValue)}`,
            );
          }
        }
      }
    }
  }

  // Show warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }

  console.log();
}
