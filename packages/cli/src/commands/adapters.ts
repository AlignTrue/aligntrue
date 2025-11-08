/**
 * Adapter management commands
 */

import {
  saveConfig,
  saveMinimalConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { tryLoadConfig } from "../utils/config-loader.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { detectNewAgents } from "../utils/detect-agents.js";

// Import AdapterManifest type from exporters package
type AdapterManifest = {
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
    const exportersPackage = require.resolve(
      "@aligntrue/exporters/package.json",
    );
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
    description: "Choose adapters with multiselect UI (enable only)",
  },
];

export async function adapters(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "adapters",
      description: "Manage exporter adapters for AI coding agents",
      usage: "aligntrue adapters <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue adapters list",
        "aligntrue adapters enable --interactive  # Recommended for new users",
        "aligntrue adapters enable cursor",
        "aligntrue adapters enable cursor claude-md vscode-mcp",
        "aligntrue adapters disable cursor",
        "aligntrue adapters detect",
        "aligntrue adapters ignore windsurf",
      ],
      notes: [
        "Adapter Status:",
        "  ✓ installed   - Enabled in config",
        "  - available   - Discovered but not enabled",
        "  ❌ invalid     - In config but not found",
        "",
        "Enable supports multiple adapters at once:",
        "  aligntrue adapters enable adapter1 adapter2 adapter3",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];
  const subArgs = parsed.positional.slice(1);

  switch (subcommand) {
    case "list":
      await listAdapters();
      break;
    case "enable":
      await enableAdapters(
        subArgs,
        parsed.flags["interactive"] as boolean | undefined,
      );
      break;
    case "disable":
      await disableAdapter(subArgs);
      break;
    case "detect":
      await detectNewAgentsCommand();
      break;
    case "ignore":
      await ignoreAgent(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue adapters --help");
      process.exit(1);
  }
}

interface AdapterInfo {
  name: string;
  manifest?: AdapterManifest;
  status: "installed" | "available" | "invalid";
}

/**
 * Discover and categorize adapters
 */
async function discoverAndCategorize(): Promise<{
  adapters: AdapterInfo[];
  config: AlignTrueConfig;
}> {
  const configPath = ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  // Load config (using utility for consistent error handling)
  const config = await tryLoadConfig(configPath);

  // Discover adapters
  const registry = new ExporterRegistry();
  let manifestPaths: string[] = [];

  try {
    if (!existsSync(exportersPath)) {
      throw new Error(`Search path not found: ${exportersPath}`);
    }
    manifestPaths = registry.discoverAdapters(exportersPath);
  } catch (_error) {
    console.error("✗ Failed to discover adapters");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }

  // Load all manifests
  const manifestMap = new Map<string, AdapterManifest>();
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = registry.loadManifest(manifestPath);
      manifestMap.set(manifest.name, manifest);
    } catch {
      // Skip invalid manifests silently
      continue;
    }
  }

  // Categorize adapters
  const adapters: AdapterInfo[] = [];
  const configuredExporters = new Set(config.exporters || []);
  const seenNames = new Set<string>();

  // Add installed (in config and found)
  for (const name of configuredExporters) {
    const manifest = manifestMap.get(name);
    if (manifest) {
      adapters.push({ name, manifest, status: "installed" });
      seenNames.add(name);
    }
  }

  // Add available (found but not in config)
  for (const [name, manifest] of manifestMap.entries()) {
    if (!seenNames.has(name)) {
      adapters.push({ name, manifest, status: "available" });
      seenNames.add(name);
    }
  }

  // Add invalid (in config but not found)
  for (const name of configuredExporters) {
    if (!seenNames.has(name)) {
      adapters.push({ name, status: "invalid" });
    }
  }

  // Sort: installed first, then available, then invalid, all alphabetically within groups
  adapters.sort((a, b) => {
    const statusOrder = { installed: 0, available: 1, invalid: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.name.localeCompare(b.name);
  });

  return { adapters, config };
}

/**
 * List all adapters with status
 */
async function listAdapters(): Promise<void> {
  const { adapters } = await discoverAndCategorize();

  const installedCount = adapters.filter(
    (a) => a.status === "installed",
  ).length;
  const availableCount = adapters.filter(
    (a) => a.status === "available",
  ).length;
  const invalidCount = adapters.filter((a) => a.status === "invalid").length;

  console.log(`\nAvailable Adapters (${adapters.length} total):\n`);

  for (const adapter of adapters) {
    const icon =
      adapter.status === "installed"
        ? "✓"
        : adapter.status === "available"
          ? "-"
          : "❌";
    const nameWidth = 24;
    const paddedName = adapter.name.padEnd(nameWidth);

    if (adapter.status === "invalid") {
      console.log(`${icon} ${paddedName}(Not found in available adapters)`);
    } else if (adapter.manifest) {
      console.log(`${icon} ${paddedName}${adapter.manifest.description}`);
      const outputs = adapter.manifest.outputs.join(", ");
      console.log(`  ${" ".repeat(nameWidth)}Outputs: ${outputs}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  ✓ Installed: ${installedCount}`);
  console.log(`  - Available: ${availableCount}`);
  if (invalidCount > 0) {
    console.log(`  ❌ Invalid: ${invalidCount}`);
  }
}

/**
 * Enable adapter(s)
 */
async function enableAdapters(
  args: string[],
  interactive?: boolean,
): Promise<void> {
  const { adapters, config } = await discoverAndCategorize();

  let adaptersToEnable: string[] = [];

  if (interactive) {
    // Interactive multiselect mode
    const choices = adapters
      .filter((a) => a.status !== "invalid")
      .map((a) => ({
        value: a.name,
        label: a.manifest?.description || a.name,
        hint: a.manifest?.outputs.join(", ") || "",
      }));

    const currentlyEnabled = new Set(config.exporters || []);

    const selected = await clack.multiselect({
      message: "Select adapters to enable:",
      options: choices,
      initialValues: choices
        .filter((c) => currentlyEnabled.has(c.value))
        .map((c) => c.value),
      required: true,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Adapter selection cancelled");
      return;
    }

    adaptersToEnable = selected as string[];
  } else {
    // Multiple adapter mode (one or more adapter names)
    if (args.length === 0) {
      console.error("✗ Missing adapter name");
      console.error(
        "  Usage: aligntrue adapters enable <adapter> [adapter2 ...]",
      );
      console.error("  Or: aligntrue adapters enable --interactive");
      process.exit(1);
    }

    const adapterNames = args;
    const notFound: string[] = [];
    const invalid: string[] = [];
    const alreadyEnabled: string[] = [];
    const toEnable: string[] = [];

    // Validate all provided adapter names
    for (const adapterName of adapterNames) {
      const adapter = adapters.find((a) => a.name === adapterName);

      if (!adapter) {
        notFound.push(adapterName);
        continue;
      }

      if (adapter.status === "invalid") {
        invalid.push(adapterName);
        continue;
      }

      if (adapter.status === "installed") {
        alreadyEnabled.push(adapterName);
        continue;
      }

      toEnable.push(adapterName);
    }

    // Report errors for any problematic adapters
    if (notFound.length > 0) {
      console.error(`✗ Adapter(s) not found: ${notFound.join(", ")}`);
      console.error("  Run: aligntrue adapters list");
      process.exit(1);
    }

    if (invalid.length > 0) {
      console.error(`✗ Invalid adapter(s): ${invalid.join(", ")}`);
      console.error(
        "  These adapters are not available in the installed exporters package",
      );
      process.exit(1);
    }

    // If all are already enabled, exit early
    if (toEnable.length === 0 && alreadyEnabled.length > 0) {
      if (alreadyEnabled.length === 1) {
        console.log(`✓ Adapter already enabled: ${alreadyEnabled[0]}`);
      } else {
        console.log(
          `✓ All adapters already enabled: ${alreadyEnabled.join(", ")}`,
        );
      }
      return;
    }

    adaptersToEnable = toEnable;
  }

  // Update config
  const currentExporters = new Set(config.exporters || []);
  let addedCount = 0;

  for (const name of adaptersToEnable) {
    if (!currentExporters.has(name)) {
      currentExporters.add(name);
      addedCount++;
    }
  }

  if (addedCount === 0) {
    console.log("✓ No changes needed (all selected adapters already enabled)");
    return;
  }

  config.exporters = Array.from(currentExporters).sort();

  // Save config (use minimal save for solo mode to keep config clean)
  try {
    if (config.mode === "solo") {
      await saveMinimalConfig(config);
    } else {
      await saveConfig(config);
    }
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }

  // Record telemetry
  recordEvent({
    command_name: "adapters-enable",
    align_hashes_used: [],
    ...(adaptersToEnable.length > 0 && {
      export_target: adaptersToEnable.join(","),
    }),
  });

  if (adaptersToEnable.length === 1) {
    console.log(`✓ Enabled adapter: ${adaptersToEnable[0]}`);
  } else {
    console.log(
      `✓ Enabled ${addedCount} adapter(s): ${adaptersToEnable.join(", ")}`,
    );
  }

  console.log("\nNext step:");
  console.log("  Run: aligntrue sync");
}

/**
 * Disable adapter
 */
async function disableAdapter(args: string[]): Promise<void> {
  const adapterName = args[0];

  if (!adapterName) {
    console.error("✗ Missing adapter name");
    console.error("  Usage: aligntrue adapters disable <adapter>");
    process.exit(1);
  }

  const { config } = await discoverAndCategorize();

  const currentExporters = config.exporters || [];

  if (!currentExporters.includes(adapterName)) {
    console.error(`✗ Adapter not enabled: ${adapterName}`);
    console.error("  Run: aligntrue adapters list");
    process.exit(1);
  }

  // Prevent disabling last adapter
  if (currentExporters.length === 1) {
    console.error("✗ Cannot disable last adapter");
    console.error("  At least one exporter must be configured");
    console.error(
      "  Enable another adapter first: aligntrue adapters enable <adapter>",
    );
    process.exit(1);
  }

  // Remove adapter
  config.exporters = currentExporters.filter((e: string) => e !== adapterName);

  // Save config (use minimal save for solo mode to keep config clean)
  try {
    if (config.mode === "solo") {
      await saveMinimalConfig(config);
    } else {
      await saveConfig(config);
    }
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }

  // Record telemetry
  recordEvent({
    command_name: "adapters-disable",
    align_hashes_used: [],
    ...(adapterName && { export_target: adapterName }),
  });

  console.log(`✓ Disabled adapter: ${adapterName}`);
}

/**
 * Manually detect new agents
 */
async function detectNewAgentsCommand(): Promise<void> {
  const { config } = await discoverAndCategorize();
  const cwd = process.cwd();

  const newAgents = detectNewAgents(
    cwd,
    config.exporters || [],
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
  console.log("  aligntrue adapters enable <agent-name>");
  console.log("\nTo ignore:");
  console.log("  aligntrue adapters ignore <agent-name>");
}

/**
 * Add agent to ignored list
 */
async function ignoreAgent(args: string[]): Promise<void> {
  const agentName = args[0];

  if (!agentName) {
    console.error("✗ Missing agent name");
    console.error("  Usage: aligntrue adapters ignore <agent>");
    process.exit(1);
  }

  const { config } = await discoverAndCategorize();

  // Check if already ignored
  const ignoredAgents = config.detection?.ignored_agents || [];
  if (ignoredAgents.includes(agentName)) {
    console.log(`✓ Agent already ignored: ${agentName}`);
    return;
  }

  // Add to ignored list
  if (!config.detection) config.detection = {};
  if (!config.detection.ignored_agents) config.detection.ignored_agents = [];
  config.detection.ignored_agents.push(agentName);

  // Save config
  try {
    if (config.mode === "solo") {
      await saveMinimalConfig(config);
    } else {
      await saveConfig(config);
    }
  } catch (_error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }

  console.log(`✓ Added to ignored list: ${agentName}`);
  console.log("\nThis agent will no longer trigger prompts during sync.");
}
