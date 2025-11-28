import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import { computeHash } from "@aligntrue/schema";
import { detectSourceRuleChanges } from "@aligntrue/core/sync";
import {
  getAlignTruePaths,
  loadConfig,
  getExporterNames,
  detectAgentFileDrift,
} from "@aligntrue/core";
import { detectNewAgents } from "../../utils/detect-agents.js";
import type { SyncOptions } from "./options.js";

/**
 * Check if sync is needed using hash-based change detection
 * (replaces unreliable timestamp-based detection per ADR-002)
 *
 * Returns true if:
 * - No previous sync (first time)
 * - Config hash changed
 * - Any source rule content changed
 * - New rule files added
 * - Rule files deleted
 * - Agent files manually edited (drift detected)
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

  // Load config
  let config;
  try {
    config = await loadConfig(configPath);
  } catch {
    // If we can't load config, assume sync is needed
    return true;
  }

  // 1. Hash-based source rule change detection (per ADR-002)
  const rulesDir = join(cwd, ".aligntrue", "rules");
  if (existsSync(rulesDir)) {
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

    // Compute config hash
    let configHash = "";
    try {
      const configContent = readFileSync(configPath, "utf-8");
      configHash = computeHash(configContent);
    } catch {
      return true;
    }

    // Detect source rule changes (includes first sync detection)
    if (detectSourceRuleChanges(cwd, currentRules, configHash)) {
      return true;
    }
  }

  // 2. Hash-based agent file drift detection (per ADR-002)
  // Detects manual edits to exported files
  const agentDrift = detectAgentFileDrift(cwd);
  if (agentDrift.length > 0) {
    return true;
  }

  // 3. Check for new agent files that aren't configured yet
  // This handles detection of newly added agent files
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
