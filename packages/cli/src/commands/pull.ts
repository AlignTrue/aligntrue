/**
 * Pull command - Pull rules from git repository ad-hoc
 *
 * Enables:
 * - Try-before-commit workflow (pull to temp by default)
 * - Team sharing (share git URLs for quick rule discovery)
 * - Exploration (test rules from any git repo without config changes)
 *
 * Strategy:
 * - Default: Pull to temp location, show results, don't modify config
 * - --save: Add git source to config permanently
 * - --sync: Run sync after pull (requires --save)
 * - --dry-run: Preview what would be pulled without pulling
 *
 * Privacy:
 * - Requires consent for git operations (first use only)
 * - Supports --offline mode (cache only, no network)
 * - Clear error messages when consent denied
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import * as clack from "@clack/prompts";
import { GitProvider, type GitSourceConfig } from "@aligntrue/sources";
import {
  createConsentManager,
  loadConfig,
  saveConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { parseMarkdown, buildIR } from "@aligntrue/markdown-parser";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import { sync as syncCommand } from "./sync.js";

/**
 * Argument definitions for pull command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--save",
    hasValue: false,
    description: "Add git source to config permanently",
  },
  {
    flag: "--ref",
    hasValue: true,
    description: "Git branch, tag, or commit (default: main)",
  },
  {
    flag: "--sync",
    hasValue: false,
    description: "Run sync immediately after pull (requires --save)",
  },
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview what would be pulled without pulling",
  },
  {
    flag: "--offline",
    hasValue: false,
    description: "Use cache only, no network operations",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Pull results for display
 */
interface PullResults {
  url: string;
  ref: string;
  ruleCount: number;
  profileId?: string;
  cached: boolean;
  tempLocation?: string;
}

/**
 * Pull command implementation
 */
export async function pull(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "pull",
      description: "Pull rules from any git repository ad-hoc",
      usage: "aligntrue pull <git-url> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "# Try rules before committing to config",
        "aligntrue pull https://github.com/yourorg/rules",
        "",
        "# Pull specific version",
        "aligntrue pull https://github.com/yourorg/rules --ref v1.2.0",
        "",
        "# Pull and add to config",
        "aligntrue pull https://github.com/yourorg/rules --save",
        "",
        "# Pull, save, and sync in one step",
        "aligntrue pull https://github.com/yourorg/rules --save --sync",
        "",
        "# Preview without pulling",
        "aligntrue pull https://github.com/yourorg/rules --dry-run",
        "",
        "# Use cache only (no network)",
        "aligntrue pull https://github.com/yourorg/rules --offline",
      ],
      notes: [
        "Default behavior: Pull to temp location without modifying config",
        "Use --save to add source to config permanently",
        "--sync requires --save (cannot sync temporary pulls)",
        "--dry-run shows preview without network operations",
      ],
    });
    process.exit(0);
  }

  // Extract positional argument (git URL)
  const url = parsed.positional[0];
  if (!url) {
    exitWithError(
      Errors.missingArgument("git-url", "aligntrue pull <git-url>"),
    );
  }

  // Extract flags
  const saveToConfig = parsed.flags["save"] as boolean | undefined;
  const ref = (parsed.flags["ref"] as string | undefined) ?? "main";
  const runSync = parsed.flags["sync"] as boolean | undefined;
  const dryRun = parsed.flags["dry-run"] as boolean | undefined;
  const offline = parsed.flags["offline"] as boolean | undefined;
  const configPath =
    (parsed.flags["config"] as string | undefined) ?? ".aligntrue/config.yaml";

  // Validate flag combinations
  if (runSync && !saveToConfig) {
    exitWithError({
      title: "Invalid flag combination",
      code: "INVALID_FLAG_COMBO",
      message: "--sync requires --save (cannot sync temporary pulls)",
      details: ["Use: aligntrue pull <url> --save --sync"],
      hint: "Remove --sync to pull without syncing, or add --save to persist the source",
    });
  }

  if (dryRun && (saveToConfig || runSync)) {
    exitWithError({
      title: "Invalid flag combination",
      code: "INVALID_FLAG_COMBO",
      message: "--dry-run cannot be used with --save or --sync",
      details: ["Dry run mode only previews without making changes"],
      hint: "Remove --dry-run to actually pull and save",
    });
  }

  // Validate ref format (security check)
  if (ref && (ref.includes(" ") || ref.length > 200)) {
    exitWithError({
      title: "Invalid git ref",
      code: "INVALID_REF",
      message: `Invalid git ref: ${ref}`,
      details: ["Ref cannot contain spaces and must be under 200 characters"],
      hint: "Use a valid branch name, tag, or commit SHA",
    });
  }

  // Record telemetry
  await recordEvent({
    command_name: "pull",
    align_hashes_used: [], // No specific hashes for pull command
  });

  try {
    // Show intro
    clack.intro("Pull rules from git repository");

    if (dryRun) {
      // Dry run mode - just show what would happen
      await displayDryRun(url, ref);
      clack.outro("✓ Dry run complete (no changes made)");
      return;
    }

    // Execute pull
    const results = await executePull(url, ref, offline ?? false, configPath);

    // Display results
    displayPullResults(results);

    // Save to config if requested
    if (saveToConfig) {
      await saveSourceToConfig(url, ref, configPath);
      clack.log.success(`Source added to ${configPath}`);
    }

    // Run sync if requested
    if (runSync) {
      clack.log.step("Running sync...");
      await syncCommand(["--config", configPath]);
    }

    // Show success message
    if (saveToConfig && runSync) {
      clack.outro("✓ Rules pulled, saved, and synced");
    } else if (saveToConfig) {
      clack.outro("✓ Rules pulled and saved to config");
    } else {
      clack.outro("✓ Rules pulled (temporary - not saved to config)");
    }
  } catch (error) {
    clack.log.error("Failed to pull rules");
    console.error(
      `\n${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Execute pull operation using GitProvider
 */
async function executePull(
  url: string,
  ref: string,
  offline: boolean,
  configPath: string,
): Promise<PullResults> {
  const spinner = clack.spinner();
  spinner.start(`Pulling from ${url} (ref: ${ref})`);

  // Create consent manager
  const consentManager = createConsentManager();

  // Check privacy consent before network operations (unless offline)
  if (!offline && !consentManager.checkConsent("git")) {
    spinner.stop("Consent required");

    // Prompt for consent
    const shouldGrant = await clack.confirm({
      message: "Git clone requires network access. Grant consent?",
      initialValue: false,
    });

    if (clack.isCancel(shouldGrant) || !shouldGrant) {
      throw new Error(
        "Network operation requires consent\n" +
          `  Repository: ${url}\n` +
          `  Grant consent with: aligntrue privacy grant git\n` +
          `  Or run with --offline to use cache only`,
      );
    }

    // Grant consent
    consentManager.grantConsent("git");
    spinner.start(`Pulling from ${url} (ref: ${ref})`);
  }

  try {
    // Load config to get mode and performance settings (but don't fail if missing)
    let mode: "solo" | "team" | "enterprise" = "solo";
    let maxFileSizeMb = 10;
    let force = false;

    try {
      const config = await loadConfig(configPath);
      mode = config.mode;
      maxFileSizeMb = config.performance?.max_file_size_mb ?? 10;
      force = false; // Pull command doesn't support --force flag
    } catch (error) {
      // Config doesn't exist or invalid - use defaults
      clack.log.warn("Config not found, using default settings");
    }

    // Create git source config
    const gitConfig: GitSourceConfig = {
      type: "git",
      url,
      ref,
      path: ".aligntrue.yaml",
      forceRefresh: false,
    };

    // Create git provider
    const provider = new GitProvider(gitConfig, ".aligntrue/.cache/git", {
      offlineMode: offline,
      consentManager,
      mode,
      maxFileSizeMb,
      force,
    });

    // Fetch rules
    const content = await provider.fetch(ref);

    // Parse and build IR to count rules
    const parseResult = parseMarkdown(content);
    const irResult = buildIR(parseResult.blocks);
    const ruleCount = irResult.document?.rules?.length ?? 0;
    const profileId = irResult.document?.id;

    spinner.stop(`✓ Pulled ${ruleCount} rule${ruleCount === 1 ? "" : "s"}`);

    return {
      url,
      ref,
      ruleCount,
      ...(profileId && { profileId }),
      cached: false, // GitProvider will log if using cache
      tempLocation: ".aligntrue/.cache/git",
    };
  } catch (error) {
    spinner.stop("✗ Pull failed");
    throw error;
  }
}

/**
 * Display pull results
 */
function displayPullResults(results: PullResults): void {
  console.log(`\n📦 Pull results:\n`);
  console.log(`  Repository: ${results.url}`);
  console.log(`  Ref: ${results.ref}`);
  console.log(`  Rules: ${results.ruleCount}`);
  if (results.profileId) {
    console.log(`  Profile: ${results.profileId}`);
  }
  console.log(`  Location: ${results.tempLocation} (cached)`);
  console.log();
}

/**
 * Save git source to config
 */
async function saveSourceToConfig(
  url: string,
  ref: string,
  configPath: string,
): Promise<void> {
  // Load existing config
  const config = await loadConfigWithValidation(configPath);

  // Add git source if not already present
  const sources = config.sources ?? [];
  const existingSource = sources.find(
    (s) => s.type === "git" && s.url === url && (s as any).ref === ref,
  );

  if (existingSource) {
    clack.log.warn(`Source already in config: ${url} (ref: ${ref})`);
    return;
  }

  // Add new source
  sources.push({
    type: "git",
    url,
    ref,
  } as any);

  // Update config
  config.sources = sources;

  // Save config
  await saveConfig(config, configPath);
}

/**
 * Display dry run preview
 */
async function displayDryRun(url: string, ref: string): Promise<void> {
  console.log(`\n🔍 Dry run preview:\n`);
  console.log(`  Repository: ${url}`);
  console.log(`  Ref: ${ref}`);
  console.log(`  Action: Would pull rules from repository`);
  console.log(`  Location: Would cache in .aligntrue/.cache/git`);
  console.log(`  Config: Would NOT modify (use --save to persist)`);
  console.log();
  console.log(`Run without --dry-run to actually pull the rules.`);
  console.log();
}
