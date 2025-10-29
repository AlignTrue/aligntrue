/**
 * Team mode management commands
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "fs";
import { dirname } from "path";
import { stringify as stringifyYaml } from "yaml";
import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { tryLoadConfig } from "../utils/config-loader.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import {
  parseAllowList,
  addSourceToAllowList,
  removeSourceFromAllowList,
  writeAllowList,
} from "@aligntrue/core/team/allow.js";

const ARG_DEFINITIONS: ArgDefinition[] = [];
const ALLOW_LIST_PATH = ".aligntrue/allow.yaml";

export async function team(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "team",
      description: "Manage team mode for collaborative rule management",
      usage: "aligntrue team <subcommand>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue team enable",
        "aligntrue team approve base-global@aligntrue/catalog@v1.0.0",
        "aligntrue team list-allowed",
        "aligntrue team remove sha256:abc123...",
      ],
      notes: [
        "Team mode features:",
        "  - Lockfile generation for reproducibility",
        "  - Bundle generation for multi-source merging",
        "  - Drift detection with soft/strict validation",
        "  - Git-based collaboration workflows",
        "  - Allow list for approved rule sources",
      ],
    });
    process.exit(0);
  }

  const subcommand = parsed.positional[0];

  switch (subcommand) {
    case "enable":
      await teamEnable();
      break;
    case "approve":
      await teamApprove(parsed.positional.slice(1));
      break;
    case "list-allowed":
      await teamListAllowed();
      break;
    case "remove":
      await teamRemove(parsed.positional.slice(1));
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue team --help");
      process.exit(1);
  }
}

async function teamEnable(): Promise<void> {
  const configPath = ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load current config (with standardized error handling)
    const config = await tryLoadConfig(configPath);

    // Check if already in team mode
    if (config.mode === "team") {
      console.log("✓ Already in team mode");
      console.log("\nTeam mode features active:");
      console.log(
        `  - Lockfile: ${config.modules?.lockfile ? "enabled" : "disabled"}`,
      );
      console.log(
        `  - Bundle: ${config.modules?.bundle ? "enabled" : "disabled"}`,
      );
      process.exit(0);
    }

    // Show what will change
    clack.intro("Team Mode Enable");

    const changes = [
      "mode: solo → team",
      "modules.lockfile: false → true",
      "modules.bundle: false → true",
    ];

    clack.log.info(
      `Changes to .aligntrue/config.yaml:\n${changes.map((c) => `  - ${c}`).join("\n")}`,
    );

    const shouldProceed = await clack.confirm({
      message: "Enable team mode?",
      initialValue: true,
    });

    if (clack.isCancel(shouldProceed) || !shouldProceed) {
      clack.cancel("Team mode enable cancelled");
      process.exit(0);
    }

    // Update config
    config.mode = "team";
    config.modules = {
      ...config.modules,
      lockfile: true,
      bundle: true,
    };

    // Write config back atomically
    const yamlContent = stringifyYaml(config);
    const tempPath = `${configPath}.tmp`;

    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true });

    // Write to temp file first
    writeFileSync(tempPath, yamlContent, "utf-8");

    // Atomic rename (OS-level guarantee)
    renameSync(tempPath, configPath);

    // Record telemetry event
    recordEvent({ command_name: "team-enable", align_hashes_used: [] });

    clack.outro("✓ Team mode enabled");

    console.log("\nNext steps:");
    console.log("  1. Run: aligntrue sync");
    console.log("  2. Lockfile will be generated automatically");
    console.log("  3. Commit both config.yaml and .aligntrue.lock.json");
    console.log("\nTeam members can now:");
    console.log("  - Clone the repo and run aligntrue sync");
    console.log("  - Get identical rule outputs (deterministic)");
    console.log("  - Detect drift with lockfile validation");
    process.exit(0);
  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to enable team mode");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Approve source(s) for team allow list
 */
async function teamApprove(sources: string[]): Promise<void> {
  try {
    // Check if at least one source provided
    if (sources.length === 0) {
      console.error("✗ No sources provided");
      console.error("  Usage: aligntrue team approve <source> [<source2> ...]");
      console.error(
        "  Example: aligntrue team approve base-global@aligntrue/catalog@v1.0.0",
      );
      process.exit(1);
    }

    // Load existing allow list
    let allowList = parseAllowList(ALLOW_LIST_PATH);

    clack.intro("Approve Rule Sources");

    // Process each source
    for (const source of sources) {
      const spinner = clack.spinner();
      spinner.start(`Resolving ${source}`);

      try {
        allowList = await addSourceToAllowList(source, allowList);
        spinner.stop(`✓ Approved: ${source}`);
      } catch (err) {
        spinner.stop(`✗ Failed: ${source}`);
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);

        // Continue with remaining sources
        if (sources.length > 1) {
          const shouldContinue = await clack.confirm({
            message: "Continue with remaining sources?",
            initialValue: true,
          });
          if (clack.isCancel(shouldContinue) || !shouldContinue) {
            process.exit(1);
          }
        } else {
          process.exit(1);
        }
      }
    }

    // Write updated allow list
    writeAllowList(ALLOW_LIST_PATH, allowList);

    // Record telemetry
    recordEvent({ command_name: "team-approve", align_hashes_used: [] });

    clack.outro(`✓ Allow list updated: ${ALLOW_LIST_PATH}`);

    console.log("\nNext steps:");
    console.log("  - Commit .aligntrue/allow.yaml to version control");
    console.log("  - Team members can now sync with approved sources");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to approve sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * List allowed sources
 */
async function teamListAllowed(): Promise<void> {
  try {
    // Load allow list
    const allowList = parseAllowList(ALLOW_LIST_PATH);

    if (allowList.sources.length === 0) {
      console.log("No approved sources");
      console.log("\nTo approve a source:");
      console.log("  aligntrue team approve <source>");
      console.log("\nExample:");
      console.log(
        "  aligntrue team approve base-global@aligntrue/catalog@v1.0.0",
      );
      process.exit(0);
    }

    console.log("Approved rule sources:");
    console.log("");

    allowList.sources.forEach((source, idx) => {
      const num = `${idx + 1}.`.padEnd(4);

      if (source.type === "id") {
        console.log(`${num}${source.value}`);
        if (source.resolved_hash) {
          console.log(`     → ${source.resolved_hash}`);
        }
      } else {
        console.log(`${num}${source.value}`);
      }

      if (source.comment) {
        console.log(`     # ${source.comment}`);
      }

      if (idx < allowList.sources.length - 1) {
        console.log("");
      }
    });

    console.log("");
    console.log(
      `Total: ${allowList.sources.length} source${allowList.sources.length !== 1 ? "s" : ""}`,
    );

    // Record telemetry
    recordEvent({ command_name: "team-list-allowed", align_hashes_used: [] });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to list allowed sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Remove source from allow list
 */
async function teamRemove(sources: string[]): Promise<void> {
  try {
    // Check if at least one source provided
    if (sources.length === 0) {
      console.error("✗ No sources provided");
      console.error("  Usage: aligntrue team remove <source> [<source2> ...]");
      console.error("  Example: aligntrue team remove sha256:abc123...");
      process.exit(1);
    }

    // Load existing allow list
    let allowList = parseAllowList(ALLOW_LIST_PATH);

    if (allowList.sources.length === 0) {
      console.log("Allow list is already empty");
      process.exit(0);
    }

    clack.intro("Remove Rule Sources");

    // Confirm removal for each source
    for (const source of sources) {
      // Check if source exists
      const exists = allowList.sources.some(
        (s) => s.value === source || s.resolved_hash === source,
      );

      if (!exists) {
        console.log(`⊗ Source not found: ${source}`);
        continue;
      }

      // Confirm removal
      const shouldRemove = await clack.confirm({
        message: `Remove ${source}?`,
        initialValue: false, // Default to no for safety
      });

      if (clack.isCancel(shouldRemove)) {
        clack.cancel("Removal cancelled");
        process.exit(0);
      }

      if (shouldRemove) {
        allowList = removeSourceFromAllowList(source, allowList);
        console.log(`✓ Removed: ${source}`);
      } else {
        console.log(`⊗ Skipped: ${source}`);
      }
    }

    // Write updated allow list
    writeAllowList(ALLOW_LIST_PATH, allowList);

    // Record telemetry
    recordEvent({ command_name: "team-remove", align_hashes_used: [] });

    clack.outro(`✓ Allow list updated: ${ALLOW_LIST_PATH}`);

    if (allowList.sources.length === 0) {
      console.log("\nAllow list is now empty");
      console.log("  Run: aligntrue team list-allowed");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to remove sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
