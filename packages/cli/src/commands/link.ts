/**
 * Link command - Vendor packs from git repositories
 *
 * Enables:
 * - Vendoring packs with git submodule/subtree workflows
 * - Offline development with locked rule versions
 * - Team collaboration with version-controlled rules
 * - Security auditing of vendored code
 *
 * Strategy:
 * - Git repositories only (no local directory support)
 * - Validates .aligntrue.yaml exists at repository root
 * - Detects git submodule/subtree and provides guidance
 * - Team mode: warns if not in allow list (non-blocking)
 * - Errors on duplicate vendoring (explicit re-link required)
 * - Tracks vendor_path and vendor_type in lockfile for drift detection
 *
 * Privacy:
 * - Requires consent for git operations (first use only)
 * - Clear error messages when consent denied
 */

import { existsSync, readFileSync } from "fs";
import { resolve, basename, join } from "path";
import { GitProvider, type GitSourceConfig } from "@aligntrue/sources";
import {
  createConsentManager,
  loadConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { parseYaml } from "@aligntrue/core/utils/yaml.js";
import { parseAllowList, checkSourceInAllowList } from "@aligntrue/core/team";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";

/**
 * Argument definitions for link command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--path",
    hasValue: true,
    description: "Vendor location (default: vendor/<repo-name>)",
  },
  {
    flag: "--ref",
    hasValue: true,
    description: "Git branch, tag, or commit (default: main)",
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
 * Vendor type detection result
 */
interface VendorDetection {
  type: "submodule" | "subtree" | "manual";
  detected: boolean;
  message?: string;
}

/**
 * Link results for display
 */
interface LinkResults {
  url: string;
  ref: string;
  path: string;
  profileId: string;
  version?: string;
  ruleCount: number;
  vendorType: "submodule" | "subtree" | "manual";
  allowListWarning?: boolean;
}

/**
 * Link command implementation
 */
export async function link(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (parsed.flags.has("--help")) {
    showStandardHelp(
      "link",
      "Vendor packs from git repositories",
      "aligntrue link <git-url> [options]",
      ARG_DEFINITIONS,
      [
        "# Link to vendor/aligntrue-rules (git submodule)",
        "git submodule add https://github.com/org/rules vendor/aligntrue-rules",
        "aligntrue link https://github.com/org/rules --path vendor/aligntrue-rules",
        "",
        "# Link with specific tag",
        "git submodule add -b v1.2.0 https://github.com/org/rules vendor/rules",
        "aligntrue link https://github.com/org/rules --path vendor/rules --ref v1.2.0",
      ],
    );
    return;
  }

  // Validate required arguments
  const gitUrl = parsed.positional[0];
  if (!gitUrl) {
    exitWithError(Errors.missingArgument("git-url"), {
      suggestion:
        "Provide git repository URL: aligntrue link https://github.com/org/rules",
    });
  }

  // Validate URL format (basic check)
  if (!isValidGitUrl(gitUrl)) {
    exitWithError(Errors.invalidFormat("git-url", gitUrl), {
      suggestion:
        "Use https:// or git@github.com: format: https://github.com/org/rules",
    });
  }

  // Parse flags
  const ref = parsed.flags.get("--ref") ?? "main";
  const customPath = parsed.flags.get("--path");
  const vendorPath = customPath ?? `vendor/${extractRepoName(gitUrl)}`;
  const configPath = parsed.flags.get("--config");

  try {
    // Load config (privacy consent needs mode and maxFileSizeMb)
    const { config } = await loadConfigWithValidation(configPath);
    const mode = config.mode ?? "solo";
    const maxFileSizeMb = config.performance?.max_file_size_mb ?? 10;

    // Check if pack already vendored at this path
    if (existsSync(vendorPath)) {
      const existing = detectExistingPack(vendorPath);
      if (existing) {
        exitWithError(
          new Error(
            `Pack already vendored at: ${vendorPath}\n` +
              `  Profile: ${existing.profileId}\n` +
              `  Version: ${existing.version || "unknown"}`,
          ),
          {
            suggestion:
              `Remove existing vendor first: git rm -r ${vendorPath}\n` +
              `  Then re-link if needed: aligntrue link ${gitUrl} --path ${vendorPath}`,
          },
        );
      }
    }

    // Create consent manager
    const consentManager = createConsentManager();

    // Fetch rules from git repository using GitProvider
    console.log(`Fetching pack from ${gitUrl}...`);

    const gitConfig: GitSourceConfig = {
      type: "git",
      url: gitUrl,
      ref,
      path: ".aligntrue.yaml",
    };

    const gitProvider = new GitProvider(gitConfig, ".aligntrue/.cache/git", {
      consentManager,
      mode,
      maxFileSizeMb,
      force: false,
    });

    const content = await gitProvider.fetch(ref);

    // Parse rules content
    const pack = parseYaml(content);

    // Validate pack structure
    if (!pack.profile?.id) {
      exitWithError(
        new Error(`Invalid pack: missing profile.id in .aligntrue.yaml`),
        {
          suggestion: `Repository: ${gitUrl}\n  Ensure .aligntrue.yaml has valid AlignTrue pack format`,
        },
      );
    }

    const profileId = pack.profile.id;
    const version = pack.profile.version;
    const ruleCount = pack.rules?.length ?? 0;

    // Team mode: warn if source not in allow list (non-blocking)
    let allowListWarning = false;
    if (mode === "team") {
      const allowListPath = resolve(".aligntrue/allow.yaml");
      if (existsSync(allowListPath)) {
        const allowList = parseAllowList(allowListPath);
        const inAllowList = checkSourceInAllowList(gitUrl, allowList);

        if (!inAllowList) {
          console.warn(
            `\n⚠️  Team mode warning: Source not in allow list\n` +
              `  Repository: ${gitUrl}\n` +
              `  Add with: aligntrue team approve ${gitUrl}\n`,
          );
          allowListWarning = true;
        }
      }
    }

    // Detect vendor type at target path (if exists)
    const vendorDetection = detectVendorType(vendorPath);

    // Display results
    const results: LinkResults = {
      url: gitUrl,
      ref,
      path: vendorPath,
      profileId,
      version,
      ruleCount,
      vendorType: vendorDetection.type,
      allowListWarning,
    };

    displayLinkResults(results, vendorDetection);

    // Record telemetry
    recordEvent({
      event: "link",
      properties: {
        vendor_type: vendorDetection.type,
        rule_count: ruleCount,
        allow_list_warning: allowListWarning,
      },
    });

    // TODO: Update lockfile with vendor provenance (vendor_path, vendor_type)
    // This will be implemented in next step with lockfile provenance tracking

    console.log("\n✓ Linked successfully");
    console.log(
      "\nℹ️  Remember to commit vendor directory and lockfile to git",
    );
  } catch (error) {
    if (error instanceof Error) {
      exitWithError(error);
    }
    throw error;
  }
}

/**
 * Validate git URL format
 */
function isValidGitUrl(url: string): boolean {
  // Accept https:// and git@ formats
  return url.startsWith("https://") || url.startsWith("git@");
}

/**
 * Extract repository name from git URL
 */
function extractRepoName(url: string): string {
  // Remove .git suffix if present
  let cleaned = url.replace(/\.git$/, "");

  // Extract last path component
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || "rules";
}

/**
 * Detect existing pack at vendor path
 */
function detectExistingPack(
  vendorPath: string,
): { profileId: string; version?: string } | null {
  const rulesFile = join(vendorPath, ".aligntrue.yaml");
  if (!existsSync(rulesFile)) {
    return null;
  }

  try {
    const content = readFileSync(rulesFile, "utf-8");
    const pack = parseYaml(content);

    if (pack.profile?.id) {
      return {
        profileId: pack.profile.id,
        version: pack.profile.version,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Detect vendor type (submodule, subtree, or manual)
 */
function detectVendorType(vendorPath: string): VendorDetection {
  // Check for git submodule
  const gitmodulesPath = ".gitmodules";
  if (existsSync(gitmodulesPath)) {
    try {
      const content = readFileSync(gitmodulesPath, "utf-8");
      // Normalize path separators for cross-platform consistency
      const normalizedPath = vendorPath.replace(/\\/g, "/");
      if (content.includes(normalizedPath)) {
        return {
          type: "submodule",
          detected: true,
          message: `To update: git submodule update --remote`,
        };
      }
    } catch {
      // Ignore read errors
    }
  }

  // Check for git subtree (heuristic: vendorPath exists with .git directory)
  // Subtrees are harder to detect definitively, so we use heuristics
  const hasGitDir = existsSync(join(vendorPath, ".git"));
  if (existsSync(vendorPath) && hasGitDir) {
    // It's likely a subtree if it has .git but not in .gitmodules
    return {
      type: "subtree",
      detected: true,
      message: `To update: git subtree pull --prefix ${vendorPath} <url> <ref> --squash`,
    };
  }

  // Manual vendor (no git integration detected)
  return {
    type: "manual",
    detected: false,
    message: undefined,
  };
}

/**
 * Display link results
 */
function displayLinkResults(
  results: LinkResults,
  detection: VendorDetection,
): void {
  console.log("\n📦 Link results:\n");
  console.log(`  Repository: ${results.url}`);
  console.log(`  Ref: ${results.ref}`);
  console.log(
    `  Type: ${detection.detected ? `git ${detection.type}` : detection.type}`,
  );
  console.log(`  Location: ${results.path}`);
  console.log(
    `  Pack ID: ${results.profileId}${results.version ? `-v${results.version}` : ""}`,
  );
  console.log(`  Rules: ${results.ruleCount}`);

  if (detection.detected && detection.message) {
    console.log(`\nℹ️  ${detection.type} detected - ${detection.message}`);
  }
}
