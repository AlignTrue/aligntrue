/**
 * Exporter management commands
 */

import {
  patchConfig,
  type AlignTrueConfig,
  getExporterNames,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { tryLoadConfig } from "../utils/config-loader.js";
import {
  parseCommonArgs,
  showStandardHelp,
  exitWithError,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { detectNewAgents } from "../utils/detect-agents.js";

const CONFIG_PATH = ".aligntrue/config.yaml";

// Import ExporterManifest type from exporters package
type ExporterManifest = {
  name: string;
  version: string;
  description: string;
  outputs: string[];
  handler?: string;
  license?: string;
  fidelityNotes?: string[];
};

// Use package resolution at runtime
function getExportersPath(): string {
  try {
    // Try to resolve exporters package at runtime
    // This works with npm global installs, symlinks, and dev environments
    const exportersPackage =
      require.resolve("@aligntrue/exporters/package.json");
    const exportersRoot = dirname(exportersPackage);
    return join(exportersRoot, "dist");
  } catch {
    // Fallback to relative path (dev/tests)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, "../../../exporters/dist");
  }
}

const exportersPath = getExportersPath();

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--interactive",
    alias: "-i",
    hasValue: false,
    description: "Choose exporters with multiselect UI (enable only)",
  },
];

export async function exporters(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "exporters",
      description: "Manage exporters for AI coding agents",
      usage: "aligntrue exporters <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue exporters list",
        "aligntrue exporters enable --interactive  # Recommended for new users",
        "aligntrue exporters enable cursor",
        "aligntrue exporters enable cursor claude vscode-mcp",
        "aligntrue exporters disable cursor",
        "aligntrue exporters detect",
        "aligntrue exporters ignore windsurf",
      ],
      notes: [
        "Exporter Status:",
        "  ✓ installed   - Enabled in config",
        "  - available   - Discovered but not enabled",
        "  ❌ invalid     - In config but not found",
        "",
        "Enable supports multiple exporters at once:",
        "  aligntrue exporters enable exporter1 exporter2 exporter3",
        "",
        "Learn more at https://aligntrue.ai/exporters",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];
  const subArgs = parsed.positional.slice(1);

  switch (subcommand) {
    case "list":
      await listExporters();
      break;
    case "enable":
      await enableExporters(
        subArgs,
        parsed.flags["interactive"] as boolean | undefined,
      );
      break;
    case "disable":
      await disableExporter(subArgs);
      break;
    case "detect":
      await detectNewAgentsCommand();
      break;
    case "ignore":
      await ignoreAgent(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue exporters --help");
      exitWithError(1, `Unknown subcommand: ${subcommand}`, {
        hint: "Run: aligntrue exporters --help",
      });
  }
}

interface ExporterInfo {
  name: string;
  manifest?: ExporterManifest;
  status: "installed" | "available" | "invalid";
}

/**
 * Discover and categorize exporters
 */
async function discoverAndCategorize(): Promise<{
  exporters: ExporterInfo[];
  config: AlignTrueConfig;
}> {
  // Check if config exists
  if (!existsSync(CONFIG_PATH)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    exitWithError(1, "Config file not found: .aligntrue/config.yaml", {
      hint: "Run: aligntrue init",
    });
  }

  // Load config (using utility for consistent error handling)
  const config = await tryLoadConfig(CONFIG_PATH);

  // Discover exporters
  const registry = new ExporterRegistry();
  let manifestPaths: string[] = [];

  try {
    if (!existsSync(exportersPath)) {
      throw new Error(`Search path not found: ${exportersPath}`);
    }
    manifestPaths = registry.discoverExporters(exportersPath);
  } catch (_error) {
    console.error("✗ Failed to discover exporters");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    exitWithError(
      1,
      `Failed to discover exporters: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  // Load all manifests
  const manifestMap = new Map<string, ExporterManifest>();
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = registry.loadManifest(manifestPath);
      manifestMap.set(manifest.name, manifest);
    } catch {
      // Skip invalid manifests silently
      continue;
    }
  }

  // Categorize exporters
  const exporters: ExporterInfo[] = [];
  const configuredExporters = new Set(getExporterNames(config.exporters));
  const seenNames = new Set<string>();

  // Add installed (in config and found)
  for (const name of configuredExporters) {
    const manifest = manifestMap.get(name);
    if (manifest) {
      exporters.push({ name, manifest, status: "installed" });
      seenNames.add(name);
    }
  }

  // Add available (found but not in config)
  for (const [name, manifest] of manifestMap.entries()) {
    if (!seenNames.has(name)) {
      exporters.push({ name, manifest, status: "available" });
      seenNames.add(name);
    }
  }

  // Add invalid (in config but not found)
  for (const name of configuredExporters) {
    if (!seenNames.has(name)) {
      exporters.push({ name, status: "invalid" });
    }
  }

  // Sort: installed first, then available, then invalid, all alphabetically within groups
  exporters.sort((a, b) => {
    const statusOrder = { installed: 0, available: 1, invalid: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.name.localeCompare(b.name);
  });

  return { exporters, config };
}

/**
 * List all exporters with status
 */
async function listExporters(): Promise<void> {
  const { exporters } = await discoverAndCategorize();

  const installedCount = exporters.filter(
    (a) => a.status === "installed",
  ).length;
  const availableCount = exporters.filter(
    (a) => a.status === "available",
  ).length;
  const invalidCount = exporters.filter((a) => a.status === "invalid").length;

  console.log(`\nAvailable Exporters (${exporters.length} total):\n`);

  for (const exporter of exporters) {
    const icon =
      exporter.status === "installed"
        ? "✓"
        : exporter.status === "available"
          ? "-"
          : "❌";
    const nameWidth = 24;
    const paddedName = exporter.name.padEnd(nameWidth);

    if (exporter.status === "invalid") {
      console.log(`${icon} ${paddedName}(Not found in available exporters)`);
    } else if (exporter.manifest) {
      console.log(`${icon} ${paddedName}${exporter.manifest.description}`);
      const outputs = exporter.manifest.outputs.join(", ");
      console.log(`  ${" ".repeat(nameWidth)}Outputs: ${outputs}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  ✓ Installed: ${installedCount}`);
  console.log(`  - Available: ${availableCount}`);
  if (invalidCount > 0) {
    console.log(`  ❌ Invalid: ${invalidCount}`);
  }

  console.log("\nNeed another agent?");
  console.log(
    "  View all supported exporters: https://aligntrue.ai/docs/04-reference/agent-support",
  );
  console.log(
    "  Don't see yours? https://aligntrue.ai/docs/07-contributing/adding-exporters",
  );
}

/**
 * Enable exporter(s)
 */
async function enableExporters(
  args: string[],
  interactive?: boolean,
): Promise<void> {
  const { exporters, config } = await discoverAndCategorize();

  let exportersToEnable: string[] = [];

  if (interactive) {
    // Interactive multiselect mode
    const choices = exporters
      .filter((a) => a.status !== "invalid")
      .map((a) => ({
        value: a.name,
        label: a.manifest?.description || a.name,
        hint: a.manifest?.outputs.join(", ") || "",
      }));

    const currentlyEnabled = new Set(getExporterNames(config.exporters));

    const selected = await clack.multiselect({
      message: "Select exporters to enable:",
      options: choices,
      initialValues: choices
        .filter((c) => currentlyEnabled.has(c.value))
        .map((c) => c.value),
      required: true,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Exporter selection cancelled");
      return;
    }

    exportersToEnable = selected as string[];
  } else {
    // Multiple exporter mode (one or more exporter names)
    if (args.length === 0) {
      console.error("✗ Missing exporter name");
      console.error(
        "  Usage: aligntrue exporters enable <exporter> [exporter2 ...]",
      );
      console.error("  Or: aligntrue exporters enable --interactive");
      exitWithError(1, "Missing exporter name", {
        hint: "Usage: aligntrue exporters enable <exporter>",
      });
    }

    const exporterNames = args;
    const notFound: string[] = [];
    const invalid: string[] = [];
    const alreadyEnabled: string[] = [];
    const toEnable: string[] = [];

    // Validate all provided exporter names
    for (const exporterName of exporterNames) {
      const exporter = exporters.find((a) => a.name === exporterName);

      if (!exporter) {
        notFound.push(exporterName);
        continue;
      }

      if (exporter.status === "invalid") {
        invalid.push(exporterName);
        continue;
      }

      if (exporter.status === "installed") {
        alreadyEnabled.push(exporterName);
        continue;
      }

      toEnable.push(exporterName);
    }

    // Report errors for any problematic exporters
    if (notFound.length > 0) {
      console.error(`✗ Exporter(s) not found: ${notFound.join(", ")}`);
      console.error("  Run: aligntrue exporters list");
      console.error(
        "  Don't see yours? https://aligntrue.ai/docs/07-contributing/adding-exporters",
      );
      exitWithError(1, `Exporter(s) not found: ${notFound.join(", ")}`, {
        hint: "Run: aligntrue exporters list",
      });
    }

    if (invalid.length > 0) {
      console.error(`✗ Invalid exporter(s): ${invalid.join(", ")}`);
      console.error(
        "  These exporters are not available in the installed exporters package",
      );
      exitWithError(1, `Invalid exporter(s): ${invalid.join(", ")}`);
    }

    // If all are already enabled, exit early
    if (toEnable.length === 0 && alreadyEnabled.length > 0) {
      if (alreadyEnabled.length === 1) {
        console.log(`✓ Exporter already enabled: ${alreadyEnabled[0]}`);
      } else {
        console.log(
          `✓ All exporters already enabled: ${alreadyEnabled.join(", ")}`,
        );
      }
      console.log("  View current exporters: aligntrue status");
      return;
    }

    exportersToEnable = toEnable;
  }

  // Update config
  const currentExporters = new Set(getExporterNames(config.exporters));
  let addedCount = 0;

  for (const name of exportersToEnable) {
    if (!currentExporters.has(name)) {
      currentExporters.add(name);
      addedCount++;
    }
  }

  if (addedCount === 0) {
    console.log("✓ No changes needed (all selected exporters already enabled)");
    console.log("  View current exporters: aligntrue status");
    return;
  }

  // Always use array format for simplicity in exporters command
  const updatedExporters = Array.from(currentExporters).sort();

  // Patch config - only update exporters, preserve everything else
  try {
    await patchConfig({ exporters: updatedExporters });
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    exitWithError(
      1,
      `Failed to save config: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  if (exportersToEnable.length === 1) {
    console.log(`✓ Enabled exporter: ${exportersToEnable[0]}`);
  } else {
    console.log(
      `✓ Enabled ${addedCount} exporter(s): ${exportersToEnable.join(", ")}`,
    );
  }

  console.log("\nRule source: .aligntrue/rules/*.md");
  console.log("\nTo view all settings:  aligntrue status");

  console.log("\nNext step:");
  console.log("  Run: aligntrue sync");

  console.log("\nLearn more at https://aligntrue.ai/agents");
}

/**
 * Disable exporter
 */
async function disableExporter(args: string[]): Promise<void> {
  const exporterName = args[0];

  if (!exporterName) {
    console.error("✗ Missing exporter name");
    console.error("  Usage: aligntrue exporters disable <exporter>");
    exitWithError(1, "Missing exporter name", {
      hint: "Usage: aligntrue exporters disable <exporter>",
    });
  }

  const { config } = await discoverAndCategorize();

  const currentExporters = getExporterNames(config.exporters);

  if (!currentExporters.includes(exporterName)) {
    console.error(`✗ Exporter not enabled: ${exporterName}`);
    console.error("  Run: aligntrue exporters list");
    exitWithError(1, `Exporter not enabled: ${exporterName}`, {
      hint: "Run: aligntrue exporters list",
    });
  }

  // Prevent disabling last exporter
  if (currentExporters.length === 1) {
    console.error("✗ Cannot disable last exporter");
    console.error("  At least one exporter must be configured");
    console.error(
      "  Enable another exporter first: aligntrue exporters enable <exporter>",
    );
    exitWithError(1, "Cannot disable last exporter", {
      hint: "Enable another exporter first: aligntrue exporters enable <exporter>",
    });
  }

  // Remove exporter and always use array format for simplicity
  const updatedExporters = currentExporters.filter(
    (e: string) => e !== exporterName,
  );

  // Patch config - only update exporters, preserve everything else
  try {
    await patchConfig({ exporters: updatedExporters });
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    exitWithError(
      1,
      `Failed to save config: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  console.log(`✓ Disabled exporter: ${exporterName}`);
}

/**
 * Manually detect new agents
 */
async function detectNewAgentsCommand(): Promise<void> {
  const { config } = await discoverAndCategorize();
  const cwd = process.cwd();

  const newAgents = detectNewAgents(
    cwd,
    getExporterNames(config.exporters),
    config.detection?.ignored_agents || [],
  );

  if (newAgents.length === 0) {
    console.log("✓ No new agents detected");
    console.log("\nAll detected agents are already enabled or ignored.");
    return;
  }

  console.log(`\nDetected ${newAgents.length} new agent(s):\n`);

  for (const agent of newAgents) {
    console.log(`  - ${agent.displayName}`);
    console.log(`    File: ${agent.filePath}`);
  }

  console.log("\nTo enable:");
  console.log("  aligntrue exporters enable <agent-name>");
  console.log("\nTo ignore:");
  console.log("  aligntrue exporters ignore <agent-name>");
}

/**
 * Add agent to ignored list
 */
async function ignoreAgent(args: string[]): Promise<void> {
  const agentName = args[0];

  if (!agentName) {
    console.error("✗ Missing agent name");
    console.error("  Usage: aligntrue exporters ignore <agent>");
    exitWithError(1, "Missing agent name", {
      hint: "Usage: aligntrue exporters ignore <agent>",
    });
  }

  const { config } = await discoverAndCategorize();

  // Check if already ignored
  const ignoredAgents = config.detection?.ignored_agents || [];
  if (ignoredAgents.includes(agentName)) {
    console.log(`✓ Agent already ignored: ${agentName}`);
    return;
  }

  // Build updated ignored_agents list
  const currentIgnored = config.detection?.ignored_agents || [];
  const updatedIgnored = [...currentIgnored, agentName];

  // Patch config - only update detection.ignored_agents, preserve everything else
  try {
    await patchConfig({
      detection: {
        ...config.detection,
        ignored_agents: updatedIgnored,
      },
    });
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    exitWithError(
      1,
      `Failed to save config: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  console.log(`✓ Added to ignored list: ${agentName}`);
  console.log("\nThis agent will no longer trigger prompts during sync.");
}
