/**
 * CLI commands for plugs management
 *
 * Commands:
 * - audit: List slots, fills, and resolution status
 * - resolve: Preview resolution with current fills (--dry-run)
 * - set: Write repo-local fill with validation
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { extname } from "path";
import { load, dump } from "js-yaml";
import { resolvePlugsForPack } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import { validatePlugValue } from "@aligntrue/schema";
import { parseMarkdown, buildIR } from "@aligntrue/markdown-parser";

/**
 * Audit command: List all slots, fills, and resolution status
 */
export async function auditPlugs(options: {
  config?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    // Load IR
    const irPath = options.config || ".aligntrue/rules.md";
    if (!existsSync(irPath)) {
      return {
        success: false,
        message: `Rules file not found: ${irPath}. Run 'aligntrue init' first.`,
      };
    }

    const irContent = readFileSync(irPath, "utf-8");
    let ir: AlignPack;

    // Detect file format and parse
    const ext = extname(irPath).toLowerCase();
    if (ext === ".md" || ext === ".markdown") {
      // Parse markdown with fenced blocks
      const parseResult = parseMarkdown(irContent);
      if (parseResult.errors.length > 0) {
        return {
          success: false,
          message: `Markdown parsing errors in ${irPath}`,
        };
      }

      const buildResult = buildIR(parseResult.blocks);
      if (buildResult.errors.length > 0) {
        return {
          success: false,
          message: `IR build errors in ${irPath}`,
        };
      }

      if (!buildResult.document) {
        return {
          success: false,
          message: `No aligntrue blocks found in ${irPath}`,
        };
      }

      ir = buildResult.document as AlignPack;
    } else {
      // Parse as YAML
      ir = load(irContent) as AlignPack;
    }

    if (!ir.plugs || (!ir.plugs.slots && !ir.plugs.fills)) {
      console.log("No plugs defined in this pack.");
      return { success: true };
    }

    const slots = ir.plugs.slots || {};
    const fills = ir.plugs.fills || {};

    console.log("\n📌 Plugs Audit\n");
    console.log("━".repeat(80));

    // Show slots
    const slotKeys = Object.keys(slots);
    if (slotKeys.length > 0) {
      console.log("\nSlots declared:");
      for (const key of slotKeys.sort()) {
        const slot = slots[key];
        if (!slot) continue;

        const fill = fills[key];
        const status = fill
          ? "✓ filled"
          : slot.required
            ? "⚠ required"
            : "○ optional";

        console.log(`\n  ${key}`);
        console.log(`    Description: ${slot.description}`);
        console.log(`    Format:      ${slot.format}`);
        console.log(`    Required:    ${slot.required}`);
        if (slot.example) {
          console.log(`    Example:     ${slot.example}`);
        }
        console.log(`    Status:      ${status}`);
        if (fill) {
          console.log(`    Fill:        ${fill}`);
        }
      }
    }

    // Show fills without slots (warnings)
    const fillKeys = Object.keys(fills);
    const orphanFills = fillKeys.filter((k) => !slots[k]);
    if (orphanFills.length > 0) {
      console.log("\n⚠️  Fills without declared slots:");
      for (const key of orphanFills.sort()) {
        console.log(`  ${key}: ${fills[key]}`);
      }
    }

    // Summary
    console.log("\n" + "━".repeat(80));
    const requiredSlots = slotKeys.filter((k) => slots[k]?.required);
    const filledRequired = requiredSlots.filter((k) => fills[k]);
    const unfilledRequired = requiredSlots.filter((k) => !fills[k]);

    console.log(`\nSummary:`);
    console.log(`  Total slots:      ${slotKeys.length}`);
    console.log(`  Required slots:   ${requiredSlots.length}`);
    console.log(`  Filled required:  ${filledRequired.length}`);
    if (unfilledRequired.length > 0) {
      console.log(`  ⚠ Unfilled required: ${unfilledRequired.length}`);
      console.log(`    ${unfilledRequired.join(", ")}`);
    }

    console.log("");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve command: Preview resolution with current fills
 */
export async function resolvePlugs(options: {
  config?: string;
  dryRun?: boolean;
}): Promise<{ success: boolean; message?: string }> {
  try {
    // Load IR
    const irPath = options.config || ".aligntrue/rules.md";
    if (!existsSync(irPath)) {
      return {
        success: false,
        message: `Rules file not found: ${irPath}. Run 'aligntrue init' first.`,
      };
    }

    const irContent = readFileSync(irPath, "utf-8");
    let ir: AlignPack;

    // Detect file format and parse
    const ext = extname(irPath).toLowerCase();
    if (ext === ".md" || ext === ".markdown") {
      // Parse markdown with fenced blocks
      const parseResult = parseMarkdown(irContent);
      if (parseResult.errors.length > 0) {
        return {
          success: false,
          message: `Markdown parsing errors in ${irPath}`,
        };
      }

      const buildResult = buildIR(parseResult.blocks);
      if (buildResult.errors.length > 0) {
        return {
          success: false,
          message: `IR build errors in ${irPath}`,
        };
      }

      if (!buildResult.document) {
        return {
          success: false,
          message: `No aligntrue blocks found in ${irPath}`,
        };
      }

      ir = buildResult.document as AlignPack;
    } else {
      // Parse as YAML
      ir = load(irContent) as AlignPack;
    }

    if (!ir.plugs) {
      console.log("No plugs defined in this pack.");
      return { success: true };
    }

    // Resolve plugs
    const result = resolvePlugsForPack(ir);

    if (!result.success) {
      console.error("\n❌ Plug resolution failed:\n");
      if (result.errors) {
        for (const error of result.errors) {
          console.error(`  ${error}`);
        }
      }
      return { success: false };
    }

    console.log("\n📋 Plugs Resolution Preview\n");
    console.log("━".repeat(80));

    // Show resolved rules
    for (const resolvedRule of result.rules) {
      if (resolvedRule.resolutions.length === 0) continue;

      console.log(`\nRule: ${resolvedRule.ruleId}`);

      for (const resolution of resolvedRule.resolutions) {
        if (resolution.resolved) {
          console.log(`  ✓ [[plug:${resolution.key}]] → "${resolution.value}"`);
        } else if (resolution.todo) {
          console.log(
            `  ⚠ [[plug:${resolution.key}]] → TODO (required but unresolved)`,
          );
        } else {
          console.log(
            `  ○ [[plug:${resolution.key}]] → (optional, not filled)`,
          );
        }
      }

      if (resolvedRule.guidance && options.dryRun) {
        console.log(`\n  Resolved guidance:`);
        const lines = resolvedRule.guidance.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            console.log(`    ${line}`);
          }
        }
      }
    }

    // Summary
    console.log("\n" + "━".repeat(80));
    const totalResolutions = result.rules.reduce(
      (sum, r) => sum + r.resolutions.length,
      0,
    );
    const resolvedCount = result.rules.reduce(
      (sum, r) => sum + r.resolutions.filter((res) => res.resolved).length,
      0,
    );
    const unresolvedCount = result.unresolvedRequired.length;

    console.log(`\nSummary:`);
    console.log(`  Total plugs:      ${totalResolutions}`);
    console.log(`  Resolved:         ${resolvedCount}`);
    if (unresolvedCount > 0) {
      console.log(`  ⚠ Unresolved required: ${unresolvedCount}`);
      console.log(`    ${result.unresolvedRequired.join(", ")}`);
    }

    console.log("");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Set command: Write repo-local fill with validation
 */
export async function setPlug(
  key: string,
  value: string,
  options: {
    config?: string;
    force?: boolean;
  },
): Promise<{ success: boolean; message?: string }> {
  try {
    // Load IR
    const irPath = options.config || ".aligntrue/rules.md";
    if (!existsSync(irPath)) {
      return {
        success: false,
        message: `Rules file not found: ${irPath}. Run 'aligntrue init' first.`,
      };
    }

    const irContent = readFileSync(irPath, "utf-8");
    let ir: AlignPack;

    // Detect file format and parse
    const ext = extname(irPath).toLowerCase();
    if (ext === ".md" || ext === ".markdown") {
      // Parse markdown with fenced blocks
      const parseResult = parseMarkdown(irContent);
      if (parseResult.errors.length > 0) {
        return {
          success: false,
          message: `Markdown parsing errors in ${irPath}`,
        };
      }

      const buildResult = buildIR(parseResult.blocks);
      if (buildResult.errors.length > 0) {
        return {
          success: false,
          message: `IR build errors in ${irPath}`,
        };
      }

      if (!buildResult.document) {
        return {
          success: false,
          message: `No aligntrue blocks found in ${irPath}`,
        };
      }

      ir = buildResult.document as AlignPack;
    } else {
      // Parse as YAML
      ir = load(irContent) as AlignPack;
    }

    // Check if slot exists
    const slot = ir.plugs?.slots?.[key];
    if (!slot && !options.force) {
      return {
        success: false,
        message: `Slot '${key}' not declared. Declare it first, or use --force to add anyway.`,
      };
    }

    // Validate value against slot format
    if (slot) {
      const validation = validatePlugValue(value, slot.format);
      if (!validation.valid) {
        return {
          success: false,
          message: `Invalid value for slot '${key}': ${validation.error}`,
        };
      }
      value = validation.sanitized || value;
    }

    // Initialize plugs if needed
    if (!ir.plugs) {
      ir.plugs = {};
    }
    if (!ir.plugs.fills) {
      ir.plugs.fills = {};
    }

    // Set fill
    const isNew = !ir.plugs.fills[key];
    ir.plugs.fills[key] = value;

    // Write back to file
    const yamlOutput = dump(ir, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    writeFileSync(irPath, yamlOutput, "utf-8");

    console.log(
      `\n${isNew ? "✓" : "↻"} ${isNew ? "Added" : "Updated"} fill: ${key} = "${value}"\n`,
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
