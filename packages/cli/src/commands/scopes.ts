/**
 * Scopes listing and discovery command
 */

import {
  loadConfig,
  saveConfig,
  discoverScopes,
  convertDiscoveredToScopes,
} from "@aligntrue/core";
import { existsSync } from "fs";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import * as clack from "@clack/prompts";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { DOCS_SCOPES } from "../constants.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Skip confirmation prompts (for discover subcommand)",
  },
];

export async function scopes(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (
    parsed.help ||
    (parsed.positional.length > 0 && parsed.positional[0] === "help")
  ) {
    showStandardHelp({
      name: "scopes",
      description: "List and discover scopes in your workspace",
      usage: "aligntrue scopes [subcommand] [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue scopes",
        "aligntrue scopes discover",
        "aligntrue scopes discover --yes",
      ],
      notes: [
        "Subcommands:",
        "  (none) - List configured scopes",
        "  discover - Auto-discover nested .aligntrue/ directories",
        "",
        "Scopes define path-based rule application in monorepos.",
        "Each scope can specify include/exclude patterns and rule overrides.",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];
  const cwd = process.cwd();

  if (subcommand === "discover") {
    await discoverSubcommand(cwd, parsed.flags);
    return;
  }

  // Default: list scopes
  await listScopes();
}

/**
 * List configured scopes
 */
async function listScopes(): Promise<void> {
  const configPath = ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load config
    const config = await loadConfig(configPath);

    // Check if scopes are defined
    if (!config.scopes || config.scopes.length === 0) {
      console.log("No scopes configured (applies rules to entire workspace)");
      console.log("\nTo add scopes, edit .aligntrue/config.yaml:");
      console.log("");
      console.log("scopes:");
      console.log("  - path: packages/frontend");
      console.log("    include:");
      console.log('      - "*.ts"');
      console.log('      - "*.tsx"');
      console.log("    exclude:");
      console.log('      - "**/*.test.ts"');
      console.log("");
      console.log(`Learn more: ${DOCS_SCOPES}`);
      return;
    }

    // Display scopes
    console.log("Scopes configured in .aligntrue/config.yaml:\n");

    for (const scope of config.scopes) {
      console.log(`  ${scope.path}`);

      if (scope.include && scope.include.length > 0) {
        console.log(`    Include: ${scope.include.join(", ")}`);
      }

      if (scope.exclude && scope.exclude.length > 0) {
        console.log(`    Exclude: ${scope.exclude.join(", ")}`);
      }

      if (scope.rulesets && scope.rulesets.length > 0) {
        console.log(`    Rulesets: ${scope.rulesets.join(", ")}`);
      }

      console.log("");
    }

    console.log(
      `Total: ${config.scopes.length} scope${config.scopes.length === 1 ? "" : "s"}`,
    );

    // Record telemetry event
    recordEvent({ command_name: "scopes", align_hashes_used: [] });
  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to load scopes");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Discover nested .aligntrue/ directories and add as scopes
 */
async function discoverSubcommand(
  cwd: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flags: Record<string, any>,
): Promise<void> {
  const yes = flags["yes"] || false;

  clack.intro("Discovering nested scopes");

  const discovered = await discoverScopes(cwd);

  if (discovered.length === 0) {
    clack.log.info("No nested .aligntrue/ directories found");
    clack.outro("Nothing to discover");
    return;
  }

  clack.log.success(
    `Found ${discovered.length} nested director${discovered.length === 1 ? "y" : "ies"}:`,
  );
  for (const scope of discovered) {
    clack.log.info(
      `  ${scope.path}/ ${scope.hasRules ? "(has rules)" : "(empty)"}`,
    );
  }

  let shouldAdd = yes;
  if (!yes) {
    const confirm = await clack.confirm({
      message: "Add these as scopes to config?",
      initialValue: true,
    });

    if (clack.isCancel(confirm)) {
      clack.cancel("Discovery cancelled");
      process.exit(0);
    }

    shouldAdd = confirm;
  }

  if (!shouldAdd) {
    clack.cancel("Discovery cancelled");
    process.exit(0);
  }

  const configPath = ".aligntrue/config.yaml";
  const config = await loadConfig(configPath, cwd);
  const newScopes = convertDiscoveredToScopes(discovered);

  config.scopes = [...(config.scopes || []), ...newScopes];

  await saveConfig(config, configPath, cwd);
  clack.log.success("Updated config with discovered scopes");

  // Record telemetry
  recordEvent({
    command_name: "scopes-discover",
    align_hashes_used: [],
  });

  clack.outro("Discovery complete");
}
