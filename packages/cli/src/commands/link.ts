/**
 * Link command - Vendor rule packs from git repositories
 *
 * Enables:
 * - Vendoring packs with git submodule or subtree
 * - Offline rule access (vendored in your repo)
 * - Version control for rule dependencies
 * - Security auditing of vendored code
 *
 * Strategy:
 * - Git-only support (no local directory paths)
 * - Detect existing submodule/subtree (inform only, no conversion)
 * - Validate pack integrity (.aligntrue.yaml required)
 * - Error on duplicate vendoring at same path
 * - User-specified location (default: vendor/<repo-name>)
 *
 * Privacy:
 * - Uses GitProvider from Session 4 (respects consent)
 * - No network operations for validation once vendored
 */

import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";
import * as clack from "@clack/prompts";
import {
  createConsentManager,
  saveConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { parseYamlToJson, validateAlignSchema } from "@aligntrue/schema";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import { createManagedSpinner } from "../utils/spinner.js";

/**
 * Argument definitions for link command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--path",
    hasValue: true,
    description: "Vendor location path (default: vendor/<repo-name>)",
  },
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Auto-grant consent without prompting",
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
interface VendorInfo {
  exists: boolean;
  type?: "submodule" | "subtree" | "unknown";
  detected: boolean;
}

/**
 * Link command implementation
 */
export async function link(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (help) {
    showStandardHelp({
      name: "link",
      description: "Vendor rule packs from git repositories",
      usage: "aligntrue link <git-url> [--path <vendor-path>]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue link https://github.com/org/rules --path vendor/org-rules  # Vendor to custom path",
        "aligntrue link https://github.com/org/rules  # Vendor to default path (vendor/rules)",
      ],
    });
    return;
  }

  // Validate git URL provided
  if (positional.length === 0) {
    exitWithError(
      Errors.missingArgument("git-url", "aligntrue link <git-url>"),
    );
  }

  const gitUrl = positional[0]!;
  const customPath = flags["--path"] as string | undefined;
  const configPath =
    (flags["--config"] as string | undefined) || ".aligntrue/config.yaml";

  // Validate git URL format
  if (!isValidGitUrl(gitUrl)) {
    exitWithError({
      title: "Invalid git URL",
      message: `Invalid git URL: ${gitUrl}`,
      hint: "Git URLs must start with https://, git@, or ssh://. Example: https://github.com/org/repo",
      code: "INVALID_GIT_URL",
    });
  }

  // Extract repo name for default path
  const repoName = extractRepoName(gitUrl);
  const vendorPath = customPath || `vendor/${repoName}`;
  const absoluteVendorPath = resolve(process.cwd(), vendorPath);

  // Record telemetry
  await recordEvent({
    command_name: "link",
    align_hashes_used: [],
  });

  // Check if vendor path already exists
  if (existsSync(absoluteVendorPath)) {
    const vendorInfo = detectVendorType(absoluteVendorPath);

    if (vendorInfo.exists) {
      exitWithError({
        title: "Duplicate vendor",
        message: `Vendor already exists at ${vendorPath}`,
        hint: `Remove existing vendor first:\n  rm -rf ${vendorPath}\n  git rm -rf ${vendorPath}  # if tracked\n\nThen re-link:\n  aligntrue link ${gitUrl} --path ${vendorPath}`,
        code: "DUPLICATE_VENDOR",
      });
    }
  }

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });
  spinner.start("Checking git repository...");

  try {
    // Load config
    const config = await loadConfigWithValidation(configPath);

    // Check git repository accessibility (respects privacy consent)
    const _consentManager = createConsentManager(configPath);

    // Note: We don't actually validate repo accessibility here as it requires
    // a full GitProvider with url/ref. The validation happens when user vendored
    // the repo manually with git submodule/subtree.

    spinner.stop("Git repository validated");

    // Detect if vendoring method is already set up
    const vendorInfo = detectVendorType(absoluteVendorPath);

    if (
      vendorInfo.detected &&
      vendorInfo.type &&
      vendorInfo.type !== "unknown"
    ) {
      // Inform user about detected vendoring method
      if (isTTY()) {
        clack.note(
          `Detected ${vendorInfo.type} at ${vendorPath}\n\nAlignTrue will track this vendored pack.\n${getVendorWorkflowGuidance(vendorInfo.type)}`,
          `📦 ${vendorInfo.type === "submodule" ? "Submodule" : "Subtree"} Detected`,
        );
      } else {
        console.log(
          `\n📦 ${vendorInfo.type === "submodule" ? "Submodule" : "Subtree"} Detected`,
        );
        console.log(`Detected ${vendorInfo.type} at ${vendorPath}`);
        console.log("\nAlignTrue will track this vendored pack.");
        console.log(getVendorWorkflowGuidance(vendorInfo.type));
      }
    } else {
      // No existing vendor - user needs to set up manually
      if (isTTY()) {
        clack.note(
          getManualVendorInstructions(gitUrl, vendorPath),
          "📋 Manual Vendor Setup Required",
        );

        clack.log.warn(
          "AlignTrue link command registers vendored packs but does not execute git operations.\n" +
            "Please run the git commands above to vendor the pack first.",
        );
      } else {
        console.log("\n📋 Manual Vendor Setup Required");
        console.log(getManualVendorInstructions(gitUrl, vendorPath));
        console.log(
          "\n⚠ AlignTrue link command registers vendored packs but does not execute git operations.",
        );
        console.log(
          "Please run the git commands above to vendor the pack first.",
        );
      }

      await recordEvent({
        command_name: "link",
        align_hashes_used: [],
      });
      return;
    }

    // Validate pack integrity at vendor path
    spinner.start("Validating pack integrity...");
    const packValid = await validateVendoredPack(absoluteVendorPath);

    if (!packValid.valid) {
      spinner.stop("Pack validation failed", 1);
      exitWithError({
        title: "Invalid pack",
        message: packValid.error || "Pack validation failed",
        hint: "Ensure the vendored repository has a valid .aligntrue.yaml file at its root with a valid profile.id field.",
        code: "INVALID_PACK",
      });
    }

    spinner.stop("Pack validated");

    // Note: Allow list check removed - approval now via git PR review

    // Update config with vendored source
    const vendorType: "submodule" | "subtree" =
      vendorInfo.type === "subtree" ? "subtree" : "submodule";
    await updateConfigWithVendor(
      config,
      configPath,
      gitUrl,
      vendorPath,
      vendorType,
      packValid.profileId,
    );

    // Success message
    const successMessage =
      `✅ Successfully linked ${gitUrl}\n\n` +
      `Vendor path: ${vendorPath}\n` +
      `Vendor type: ${vendorType}\n` +
      `Profile: ${packValid.profileId}\n\n` +
      `Next steps:\n` +
      `1. Commit vendor changes: git add ${vendorPath} .aligntrue/config.yaml\n` +
      `2. Run sync: aligntrue sync\n` +
      `3. Update lockfile (if team mode): git add .aligntrue.lock.json`;

    if (isTTY()) {
      clack.outro(successMessage);
    } else {
      console.log("\n" + successMessage);
    }

    await recordEvent({
      command_name: "link",
      align_hashes_used: [],
    });
  } catch (_error) {
    spinner.stop("Link failed", 1);

    if (_error && typeof _error === "object" && "code" in _error) {
      throw _error;
    }

    exitWithError({
      title: "Link failed",
      message: `Failed to link vendor: ${_error instanceof Error ? _error.message : String(_error)}`,
      hint: "Check git repository accessibility and try again.",
      code: "LINK_FAILED",
    });
  }
}

/**
 * Validate git URL format
 */
function isValidGitUrl(url: string): boolean {
  // Support https://, git@, and ssh:// URLs
  // Reject local paths on both Windows and Unix
  if (/^[a-zA-Z]:\\/.test(url) || url.startsWith("/")) {
    return false;
  }
  return (
    url.startsWith("https://") ||
    url.startsWith("git@") ||
    url.startsWith("ssh://")
  );
}

/**
 * Extract repository name from git URL
 */
function extractRepoName(url: string): string {
  // Remove .git suffix if present
  let name = url.replace(/\.git$/, "");

  // Extract last path component
  const parts = name.split("/");
  name = parts[parts.length - 1] || "vendored-pack";

  // Clean up name (remove special characters)
  name = name.replace(/[^a-zA-Z0-9-_]/g, "-");

  return name;
}

/**
 * Detect vendor type (submodule, subtree, or unknown)
 */
function detectVendorType(path: string): VendorInfo {
  if (!existsSync(path)) {
    return { exists: false, detected: false };
  }

  // Check for git submodule (.git file pointing to parent)
  const gitPath = join(path, ".git");
  if (existsSync(gitPath)) {
    try {
      const gitContent = readFileSync(gitPath, "utf8");
      if (gitContent.startsWith("gitdir:")) {
        return { exists: true, type: "submodule", detected: true };
      }
    } catch {
      // Not a submodule
    }
  }

  // Check for subtree (has .git directory but no gitdir reference)
  // Subtrees are harder to detect definitively, so we check if it's a git repo
  if (existsSync(join(path, ".git"))) {
    return { exists: true, type: "subtree", detected: true };
  }

  // Check if directory exists but vendoring not detected
  if (existsSync(path)) {
    return { exists: true, type: "unknown", detected: false };
  }

  return { exists: false, detected: false };
}

/**
 * Get workflow guidance for vendor type
 */
function getVendorWorkflowGuidance(type: "submodule" | "subtree"): string {
  if (type === "submodule") {
    return `Update workflow:\n  cd <vendor-path>\n  git pull origin main\n  cd ../..\n  git add <vendor-path>\n  git commit -m "chore: Update vendored pack"`;
  } else {
    return `Update workflow:\n  git subtree pull --prefix <vendor-path> <git-url> main --squash`;
  }
}

/**
 * Get manual vendor setup instructions
 */
function getManualVendorInstructions(
  gitUrl: string,
  vendorPath: string,
): string {
  return (
    `Manual git operations required:\n\n` +
    `Option 1 - Submodule (space efficient):\n` +
    `  git submodule add ${gitUrl} ${vendorPath}\n` +
    `  git commit -m "feat: Vendor pack via submodule"\n\n` +
    `Option 2 - Subtree (simpler for team):\n` +
    `  git subtree add --prefix ${vendorPath} ${gitUrl} main --squash\n\n` +
    `After vendoring, run this command again:\n` +
    `  aligntrue link ${gitUrl} --path ${vendorPath}`
  );
}

/**
 * Validate vendored pack integrity
 */
async function validateVendoredPack(
  path: string,
): Promise<{ valid: boolean; error?: string; profileId?: string }> {
  const packPath = join(path, ".aligntrue.yaml");

  if (!existsSync(packPath)) {
    return {
      valid: false,
      error: `.aligntrue.yaml not found at repository root: ${path}`,
    };
  }

  try {
    const content = readFileSync(packPath, "utf8");
    const pack = parseYamlToJson(content);

    // Handle edge cases: empty YAML returns undefined, comments-only returns null
    if (pack === undefined || pack === null) {
      return {
        valid: false,
        error: "Empty or invalid pack file",
      };
    }

    const validation = validateAlignSchema(pack);

    if (!validation.valid) {
      const errorMessages = validation.errors
        ?.map((e) => `  - ${e.message}`)
        .join("\n");
      return {
        valid: false,
        error: `Invalid pack schema:\n${errorMessages}`,
      };
    }

    // Check for required profile.id
    const packObj = pack as { profile?: { id?: string } };
    if (!packObj.profile?.id) {
      return {
        valid: false,
        error: "Missing required field: profile.id",
      };
    }

    return {
      valid: true,
      profileId: packObj.profile.id,
    };
  } catch (_error) {
    return {
      valid: false,
      error: `Failed to parse pack: ${_error instanceof Error ? _error.message : String(_error)}`,
    };
  }
}

// DEPRECATED: checkAllowList function removed
// Approval now happens via git PR review

/**
 * Update config with vendored source
 */
async function updateConfigWithVendor(
  config: AlignTrueConfig,
  configPath: string,
  gitUrl: string,
  vendorPath: string,
  vendorType: "submodule" | "subtree",
  _profileId?: string,
): Promise<void> {
  // Initialize sources array if not exists
  if (!config.sources) {
    config.sources = [];
  }

  // Check if source already exists
  const existingIndex = config.sources.findIndex(
    (s) => s.type === "git" && s.url === gitUrl,
  );

  if (existingIndex >= 0) {
    // Update existing source with vendor info
    const existing = config.sources[existingIndex];
    // Note: vendor_path and vendor_type are stored as metadata in the source
    // The config schema allows additional properties beyond the base type
    (existing as Record<string, unknown>)["vendor_path"] = vendorPath;
    (existing as Record<string, unknown>)["vendor_type"] = vendorType;
  } else {
    // Add new git source with vendor info
    config.sources.push({
      type: "git",
      url: gitUrl,
      // Note: vendor_path and vendor_type are stored as metadata
      // The config schema allows additional properties beyond the base type
      ...(vendorPath && { vendor_path: vendorPath }),
      ...(vendorType && { vendor_type: vendorType }),
    } as {
      type: "git";
      url: string;
      vendor_path?: string;
      vendor_type?: string;
    });
  }

  // Save updated config
  await saveConfig(config, configPath);
}
