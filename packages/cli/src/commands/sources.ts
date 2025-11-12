/**
 * Sources command - Manage git and local sources
 * List status, update sources, and pin to specific versions
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { loadConfig, saveConfig } from "@aligntrue/core";
import { GitProvider, loadCacheMeta, detectRefType } from "@aligntrue/sources";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--all",
    hasValue: false,
    description: "Apply operation to all sources",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Sources command entry point
 */
export async function sources(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "sources",
      description: "Manage git and local rule sources",
      usage: "aligntrue sources <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue sources list",
        "aligntrue sources status",
        "aligntrue sources update https://github.com/org/rules",
        "aligntrue sources update --all",
        "aligntrue sources pin https://github.com/org/rules abc1234",
      ],
      notes: [
        "Subcommands:",
        "  list    - Show all configured sources",
        "  status  - Show detailed status with update info",
        "  update  - Force update specific source or all",
        "  pin     - Pin git source to specific commit SHA",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];

  switch (subcommand) {
    case "list":
      await sourcesList(parsed.flags);
      break;
    case "status":
      await sourcesStatus(parsed.flags);
      break;
    case "update":
      await sourcesUpdate(parsed.positional.slice(1), parsed.flags);
      break;
    case "pin":
      await sourcesPin(parsed.positional.slice(1), parsed.flags);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run 'aligntrue sources --help' for usage");
      process.exit(1);
  }
}

/**
 * List all configured sources
 */
async function sourcesList(
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const configPath =
    (flags["config"] as string | undefined) || ".aligntrue/config.yaml";

  if (!existsSync(configPath)) {
    exitWithError(Errors.configNotFound(configPath), 2);
  }

  const config = await loadConfig(configPath);
  const sources = config.sources || [];

  if (sources.length === 0) {
    console.log("No sources configured\n");
    return;
  }

  console.log("\nConfigured Sources:\n");

  for (const [index, source] of sources.entries()) {
    const num = index + 1;
    if (source.type === "local") {
      console.log(`${num}. Local: ${source.path}`);
    } else if (source.type === "git") {
      const ref = source.ref || "main";
      console.log(`${num}. Git: ${source.url} (${ref})`);
    }
  }

  console.log();
}

/**
 * Show detailed status of all sources
 */
async function sourcesStatus(
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const configPath =
    (flags["config"] as string | undefined) || ".aligntrue/config.yaml";

  if (!existsSync(configPath)) {
    exitWithError(Errors.configNotFound(configPath), 2);
  }

  const config = await loadConfig(configPath);
  const sources = config.sources || [];

  if (sources.length === 0) {
    console.log("No sources configured\n");
    return;
  }

  clack.intro("Sources Status");

  for (const source of sources) {
    if (source.type === "local") {
      console.log(`\n📄 Local: ${source.path}`);
      const exists = existsSync(source.path || "");
      console.log(`  Status: ${exists ? "✓ Exists" : "✗ Not found"}`);
    } else if (source.type === "git") {
      const url = source.url || "";
      const ref = source.ref || "main";
      const refType = detectRefType(ref);

      console.log(`\n📦 Git: ${url}`);
      console.log(`  Ref: ${ref} (${refType})`);

      // Check cache
      const { createHash } = await import("crypto");
      const repoHash = createHash("sha256")
        .update(url)
        .digest("hex")
        .substring(0, 16);
      const repoDir = `.aligntrue/.cache/git/${repoHash}`;

      if (existsSync(repoDir)) {
        const meta = loadCacheMeta(repoDir);
        if (meta) {
          console.log(`  Cached SHA: ${meta.resolvedSha.slice(0, 7)}`);
          console.log(
            `  Last checked: ${new Date(meta.lastChecked).toLocaleString()}`,
          );
          console.log(
            `  Last fetched: ${new Date(meta.lastFetched).toLocaleString()}`,
          );

          // Check if TTL expired
          const now = new Date();
          const lastChecked = new Date(meta.lastChecked);
          const hoursSinceCheck =
            (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCheck > 24) {
            console.log(
              `  ⚠️  Check overdue (${Math.round(hoursSinceCheck)}h since last check)`,
            );
          } else {
            console.log(`  ✓ Up to date`);
          }
        } else {
          console.log(`  Status: Cached (no metadata)`);
        }
      } else {
        console.log(`  Status: Not cached`);
      }
    }
  }

  console.log();
  clack.outro("Use 'aligntrue sources update' to refresh git sources");
}

/**
 * Update (force refresh) git sources
 */
async function sourcesUpdate(
  urls: string[],
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const configPath =
    (flags["config"] as string | undefined) || ".aligntrue/config.yaml";
  const all = flags["all"] as boolean | undefined;

  if (!existsSync(configPath)) {
    exitWithError(Errors.configNotFound(configPath), 2);
  }

  const config = await loadConfig(configPath);
  const sources = config.sources || [];

  // Determine which sources to update
  let toUpdate: typeof sources = [];
  if (all) {
    toUpdate = sources.filter((s) => s.type === "git");
  } else if (urls.length > 0) {
    toUpdate = sources.filter(
      (s) => s.type === "git" && urls.includes(s.url || ""),
    );
  } else {
    console.error("✗ No sources specified");
    console.error("  Usage: aligntrue sources update <url>");
    console.error("  Or: aligntrue sources update --all");
    process.exit(1);
  }

  if (toUpdate.length === 0) {
    console.log("No git sources to update\n");
    return;
  }

  clack.intro(`Update Git Sources (${toUpdate.length})`);

  for (const source of toUpdate) {
    if (source.type !== "git" || !source.url) continue;

    const spinner = clack.spinner();
    spinner.start(`Updating ${source.url}...`);

    try {
      const gitConfig = {
        type: "git" as const,
        url: source.url,
        ref: source.ref || "main",
        path: source.path || ".aligntrue.yaml",
        forceRefresh: true,
        checkInterval: 0,
      };

      const provider = new GitProvider(gitConfig, ".aligntrue/.cache/git", {
        mode: config.mode || "solo",
      });

      await provider.fetch();
      const sha = await provider.getCommitSha();

      spinner.stop(`✓ Updated ${source.url} (${sha.slice(0, 7)})`);
    } catch (error) {
      spinner.stop(`✗ Failed to update ${source.url}`);
      console.error(
        `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  clack.outro("✓ Updates complete");
}

/**
 * Pin git source to specific commit SHA
 */
async function sourcesPin(
  args: string[],
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  if (args.length < 2) {
    console.error("✗ Usage: aligntrue sources pin <url> <sha>");
    console.error(
      "  Example: aligntrue sources pin https://github.com/org/rules abc1234",
    );
    process.exit(1);
  }

  const url = args[0];
  const sha = args[1];

  const configPath =
    (flags["config"] as string | undefined) || ".aligntrue/config.yaml";

  if (!existsSync(configPath)) {
    exitWithError(Errors.configNotFound(configPath), 2);
  }

  const config = await loadConfig(configPath);
  const sources = config.sources || [];

  // Find the source
  const sourceIndex = sources.findIndex(
    (s) => s.type === "git" && s.url === url,
  );

  if (sourceIndex === -1) {
    console.error(`✗ Source not found: ${url}`);
    process.exit(1);
  }

  // Update ref to SHA
  const source = sources[sourceIndex];
  if (source && source.type === "git") {
    source.ref = sha as string;
  }
  config.sources = sources;

  // Save config
  await saveConfig(config, configPath);

  console.log("\n✓ Pinned git source:");
  console.log(`  Repository: ${url}`);
  console.log(`  SHA: ${sha}`);
  console.log("\nNext steps:");
  console.log(
    "  aligntrue sync --force-refresh   # Fetch and sync with pinned version",
  );
  console.log();
}
