/**
 * Adapter management commands
 */

import { saveConfig, type AlignTrueConfig } from "@aligntrue/core";
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

// Determine exporters package path (relative to CLI)
// In built dist: cli/dist/commands/adapters.js -> ../../../../exporters/src
// In tests/dev: cli/src/commands/adapters.ts -> ../../../../exporters/src
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let exportersPath = join(__dirname, "../../../../exporters/src");

// If running from built dist, adjust path
if (__dirname.includes("/dist/")) {
  exportersPath = join(__dirname, "../../../../exporters/src");
} else {
  // Running from src (tests/dev)
  exportersPath = join(__dirname, "../../../exporters/src");
}

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
        "aligntrue adapters enable cursor",
        "aligntrue adapters enable --interactive",
        "aligntrue adapters disable cursor",
      ],
      notes: [
        "Adapter Status:",
        "  ✓ installed   - Enabled in config",
        "  - available   - Discovered but not enabled",
        "  ❌ invalid     - In config but not found",
      ],
    });
    process.exit(0);
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
    manifestPaths = registry.discoverAdapters(exportersPath);
  } catch (error) {
    console.error("✗ Failed to discover adapters");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  // Load all manifests
  const manifestMap = new Map<string, AdapterManifest>();
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = registry.loadManifest(manifestPath);
      manifestMap.set(manifest.name, manifest);
    } catch (error) {
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

  process.exit(0);
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
      process.exit(0);
    }

    adaptersToEnable = selected as string[];
  } else {
    // Single adapter mode
    if (args.length === 0) {
      console.error("✗ Missing adapter name");
      console.error("  Usage: aligntrue adapters enable <adapter>");
      console.error("  Or: aligntrue adapters enable --interactive");
      process.exit(1);
    }

    const adapterName = args[0];
    if (!adapterName) {
      console.error("✗ Missing adapter name");
      console.error("  Usage: aligntrue adapters enable <adapter>");
      process.exit(1);
    }

    const adapter = adapters.find((a) => a.name === adapterName);

    if (!adapter) {
      console.error(`✗ Adapter not found: ${adapterName}`);
      console.error("  Run: aligntrue adapters list");
      process.exit(1);
    }

    if (adapter.status === "invalid") {
      console.error(`✗ Invalid adapter: ${adapterName}`);
      console.error(
        "  This adapter is not available in the installed exporters package",
      );
      process.exit(1);
    }

    if (adapter.status === "installed") {
      console.log(`✓ Adapter already enabled: ${adapterName}`);
      process.exit(0);
    }

    adaptersToEnable = [adapterName];
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
    process.exit(0);
  }

  config.exporters = Array.from(currentExporters).sort();

  // Save config
  try {
    await saveConfig(config);
  } catch (error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}`,
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

  process.exit(0);
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

  // Save config
  try {
    await saveConfig(config);
  } catch (error) {
    console.error("✗ Failed to save config");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}`,
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

  process.exit(0);
}
