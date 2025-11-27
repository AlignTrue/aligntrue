/**
 * Ruler project detection and migration during init
 * Detects .ruler/ directory and offers automatic migration
 */

import { existsSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import {
  copyRulerFilesToAlignTrue,
  copyAgentsMdIfNeeded,
  shouldIncludeAgentsMd,
  parseRulerToml,
  convertRulerConfig,
  getAlignTruePaths,
} from "@aligntrue/core";
import type { AlignTrueConfig } from "@aligntrue/core";
import { isTTY } from "../../utils/tty-helper.js";

/**
 * Check if project has a .ruler directory
 */
export function detectRulerProject(cwd: string): boolean {
  const rulerDir = join(cwd, ".ruler");
  return existsSync(rulerDir);
}

/**
 * Offer to migrate from Ruler during init
 * Returns AlignTrue config from ruler.toml if user accepts, undefined otherwise
 */
export async function promptRulerMigration(
  cwd: string,
): Promise<Partial<AlignTrueConfig> | undefined> {
  const rulerDir = join(cwd, ".ruler");
  const paths = getAlignTruePaths(cwd);
  const rulesDir = paths.rules;

  if (!isTTY()) {
    // Non-interactive mode: skip silently
    return undefined;
  }

  clack.log.info("Ruler project detected (.ruler/ directory found)");

  const importRuler = await clack.confirm({
    message: "Import rules from Ruler?",
    initialValue: true,
  });

  if (clack.isCancel(importRuler) || !importRuler) {
    return undefined;
  }

  // Copy files
  const copiedFiles = await copyRulerFilesToAlignTrue(rulerDir, rulesDir);
  clack.log.success(
    `Copied ${copiedFiles.length} file${copiedFiles.length !== 1 ? "s" : ""} to .aligntrue/rules/`,
  );

  // Check for AGENTS.md
  if (shouldIncludeAgentsMd(cwd)) {
    const includeAgents = await clack.confirm({
      message: "Include existing AGENTS.md in your rules?",
      initialValue: false,
    });

    if (includeAgents) {
      await copyAgentsMdIfNeeded(cwd, rulesDir);
      clack.log.success("Copied AGENTS.md to .aligntrue/rules/agents.md");
    }
  }

  // Try to read config from ruler.toml
  let aligntrueConfig: Partial<AlignTrueConfig> | undefined;
  const rulerTomlPath = join(rulerDir, "ruler.toml");

  try {
    const rulerConfig = parseRulerToml(rulerTomlPath);
    aligntrueConfig = convertRulerConfig(rulerConfig);
    if (
      aligntrueConfig.exporters &&
      Array.isArray(aligntrueConfig.exporters) &&
      aligntrueConfig.exporters.length > 0
    ) {
      clack.log.success(
        `Imported enabled agents from ruler.toml: ${aligntrueConfig.exporters.join(", ")}`,
      );
    }
  } catch {
    // ruler.toml may not exist or may be invalid - not critical
  }

  return aligntrueConfig;
}
