import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import { computeHash } from "@aligntrue/schema";
import { detectSourceRuleChanges } from "@aligntrue/core/sync";
import {
  getAlignTruePaths,
  loadMergedConfig,
  getExporterNames,
  isTeamModeActive,
  getExportFileHashes,
} from "@aligntrue/core";
import { detectNewAgents } from "../../utils/detect-agents.js";
import type { SyncOptions } from "./options.js";

/**
 * Check if sync is needed using hash-based change detection
 *
 * Returns true if:
 * - No previous sync (first time)
 * - Config hash changed
 * - Any source rule content changed
 * - New rule files added
 * - Rule files deleted
 * - New agent files detected that aren't configured yet
 * - CLI flags that override export behavior (e.g., --content-mode)
 *
 * @returns true if sync is needed, false if everything is up to date
 */
export async function checkIfSyncNeeded(
  options: SyncOptions,
): Promise<boolean> {
  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);

  // If --content-mode is explicitly provided, always re-export
  // This ensures the user's intent to change export format is respected
  if (options.contentMode) {
    return true;
  }

  // Load merged config (handles both solo and team modes)
  let config;
  try {
    const mergeResult = await loadMergedConfig(cwd);
    config = mergeResult.config;
  } catch {
    // If we can't load config, assume sync is needed
    return true;
  }

  // 1. Hash-based source rule change detection
  const rulesDir = join(cwd, ".aligntrue", "rules");
  if (!existsSync(rulesDir)) {
    // Rules directory missing - sync is needed (will fail with proper error in buildSyncContext)
    return true;
  }

  const ruleFiles = globSync("**/*.md", { cwd: rulesDir, absolute: true });
  const currentRules: Record<string, string> = {};

  // Compute hash for each rule file
  for (const file of ruleFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const hash = computeHash(content);
      const relPath = file.replace(cwd + "/", "");
      currentRules[relPath] = hash;
    } catch {
      // If we can't read a file, assume sync is needed
      return true;
    }
  }

  // Compute config hash (include both config files in team mode)
  let configHash = "";
  try {
    let configContent = existsSync(paths.config)
      ? readFileSync(paths.config, "utf-8")
      : "";

    // In team mode, also include team config in hash
    if (isTeamModeActive(cwd) && existsSync(paths.teamConfig)) {
      configContent += readFileSync(paths.teamConfig, "utf-8");
    }

    configHash = computeHash(configContent);
  } catch {
    return true;
  }

  // Detect source rule changes (includes first sync detection)
  if (detectSourceRuleChanges(cwd, currentRules, configHash)) {
    return true;
  }

  // 2. Check for new agent files that aren't configured yet
  // This handles detection of newly added agent files
  const newAgents = detectNewAgents(
    cwd,
    getExporterNames(config.exporters),
    config.detection?.ignored_agents || [],
  );
  if (newAgents.length > 0) {
    return true; // New agents need to be detected and onboarded
  }

  // 3. Detect manual edits to exported agent files (AGENTS.md, .cursor/*.mdc, etc.)
  const exportHashes = getExportFileHashes(cwd);
  if (!exportHashes || !exportHashes.files) {
    return true; // No baseline -> re-export to establish hashes
  }

  for (const [relPath, storedHash] of Object.entries(exportHashes.files)) {
    const absolutePath = join(cwd, relPath);
    if (!existsSync(absolutePath)) {
      return true; // Export missing
    }

    try {
      const currentContent = readFileSync(absolutePath, "utf-8");
      const currentHash = computeHash(currentContent);
      if (currentHash !== storedHash) {
        return true; // Export drifted
      }
    } catch {
      return true; // Unable to read -> force regen
    }
  }

  // 4. Check if managed .gitignore section needs restoration
  const gitMode = config.git?.mode || "ignore";
  if (gitMode === "ignore") {
    const gitignorePath = join(cwd, ".gitignore");
    if (!existsSync(gitignorePath)) {
      return true; // Create managed .gitignore
    }
    try {
      const gitignoreContent = readFileSync(gitignorePath, "utf-8");
      const hasManagedSection =
        gitignoreContent.includes("# START AlignTrue Generated Files") &&
        gitignoreContent.includes("# END AlignTrue Generated Files");
      if (!hasManagedSection) {
        return true; // Restore managed section
      }
    } catch {
      return true; // Can't read gitignore, assume sync needed
    }
  }

  // Nothing changed
  return false;
}
