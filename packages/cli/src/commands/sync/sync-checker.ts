import { existsSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import {
  getLastSyncTimestamp,
  wasFileModifiedSince,
} from "@aligntrue/core/sync/tracking";
import {
  getAlignTruePaths,
  loadConfig,
  getExporterNames,
} from "@aligntrue/core";
import { detectNewAgents } from "../../utils/detect-agents.js";
import type { SyncOptions } from "./options.js";

/**
 * Check if sync is needed by comparing file modification times
 * against last sync timestamp
 *
 * Returns true if:
 * - No previous sync (first time)
 * - Config changed
 * - IR changed
 * - Any agent file changed
 * - Any source file changed
 * - New agent files detected that aren't configured yet
 *
 * @returns true if sync is needed, false if everything is up to date
 */
export async function checkIfSyncNeeded(
  options: SyncOptions,
): Promise<boolean> {
  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = options.configPath || paths.config;

  // If no last sync timestamp, sync is needed (first time)
  const lastSyncTime = getLastSyncTimestamp(cwd);
  if (!lastSyncTime) {
    return true;
  }

  // Check if config changed
  if (wasFileModifiedSince(configPath, lastSyncTime)) {
    return true;
  }

  // Check if IR changed
  if (
    existsSync(paths.rules) &&
    wasFileModifiedSince(paths.rules, lastSyncTime)
  ) {
    return true;
  }

  // Load config to check configured files
  let config;
  try {
    config = await loadConfig(configPath);
  } catch {
    // If we can't load config, assume sync is needed
    return true;
  }

  // Check AGENTS.md
  const agentsMdPath = paths.agentsMd();
  if (
    existsSync(agentsMdPath) &&
    wasFileModifiedSince(agentsMdPath, lastSyncTime)
  ) {
    return true;
  }

  // Check Cursor .mdc files
  const cursorFiles = globSync(".cursor/rules/*.mdc", { cwd, absolute: true });
  for (const file of cursorFiles) {
    if (wasFileModifiedSince(file, lastSyncTime)) {
      return true;
    }
  }

  // Check configured source files
  if (config.sources) {
    for (const source of config.sources) {
      if (source.type === "local" && source.path) {
        const sourcePath = join(cwd, source.path);
        if (
          existsSync(sourcePath) &&
          wasFileModifiedSince(sourcePath, lastSyncTime)
        ) {
          return true;
        }
      }
    }
  }

  // Check .aligntrue/rules/**/*.md files (new IR format)
  const rulesDir = join(cwd, ".aligntrue", "rules");
  if (existsSync(rulesDir)) {
    const ruleFiles = globSync("**/*.md", { cwd: rulesDir, absolute: true });
    for (const file of ruleFiles) {
      if (wasFileModifiedSince(file, lastSyncTime)) {
        return true;
      }
    }
  }

  // Check for new agent files that aren't configured yet
  // This handles the case where files were added/copied but have old mtimes
  const newAgents = detectNewAgents(
    cwd,
    getExporterNames(config.exporters),
    config.detection?.ignored_agents || [],
  );
  if (newAgents.length > 0) {
    return true; // New agents need to be detected and onboarded
  }

  // Nothing changed
  return false;
}
