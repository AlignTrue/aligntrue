/**
 * Scope auto-discovery engine
 * Discovers nested .aligntrue/ directories and converts them to scope configurations
 */

import { readdirSync, existsSync } from "fs";
import { join, relative } from "path";
import type { AlignTrueConfig } from "./config/index.js";

export interface DiscoveredScope {
  path: string;
  configPath: string;
  hasRules: boolean;
  ruleFiles: string[];
}

export interface ScopeDiscoveryOptions {
  maxDepth?: number;
  ignore?: string[];
}

/**
 * Discover nested .aligntrue/ directories in the workspace
 *
 * @param rootDir - Root directory to search from
 * @param options - Discovery options
 * @returns Array of discovered scopes
 */
export async function discoverScopes(
  rootDir: string,
  options: ScopeDiscoveryOptions = {},
): Promise<DiscoveredScope[]> {
  const discovered: DiscoveredScope[] = [];
  const maxDepth = options.maxDepth ?? 10;
  const ignore = options.ignore ?? [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
  ];

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ignore.includes(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      const aligntrueDir = join(fullPath, ".aligntrue");

      if (existsSync(aligntrueDir)) {
        const configPath = join(aligntrueDir, "config.yaml");
        const rulesDir = join(aligntrueDir, "rules");

        // Check for rules directory with markdown files
        let ruleFiles: string[] = [];
        if (existsSync(rulesDir)) {
          const { readdirSync } = await import("fs");
          ruleFiles = readdirSync(rulesDir)
            .filter((f) => f.endsWith(".md"))
            .map((f) => join(rulesDir, f));
        }

        discovered.push({
          path: relative(rootDir, fullPath),
          configPath: existsSync(configPath) ? configPath : "",
          hasRules: ruleFiles.length > 0,
          ruleFiles,
        });
      }

      await walk(fullPath, depth + 1);
    }
  }

  await walk(rootDir, 0);
  return discovered;
}

/**
 * Convert discovered scopes to AlignTrue scope configuration
 *
 * @param discovered - Array of discovered scopes
 * @returns Scope configuration array
 */
export function convertDiscoveredToScopes(
  discovered: DiscoveredScope[],
): NonNullable<AlignTrueConfig["scopes"]> {
  return discovered.map((d) => ({
    path: d.path || ".",
    include: ["**/*"],
    rulesets: [`${d.path}-rules`],
  }));
}
