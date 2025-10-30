/**
 * Centralized path utilities for AlignTrue
 *
 * Provides consistent path generation across CLI commands and exporters.
 * Eliminates duplication and ensures cross-platform compatibility.
 */

import { join } from "path";

/**
 * Standard AlignTrue file paths
 *
 * @param cwd - Current working directory (default: process.cwd())
 * @returns Object with standardized path functions
 *
 * @example
 * ```typescript
 * const paths = getAlignTruePaths()
 * const configPath = paths.config
 * const scopedRule = paths.cursorRules('default')
 * ```
 */
export function getAlignTruePaths(cwd: string = process.cwd()) {
  return {
    /** Path to main config file: .aligntrue/config.yaml */
    config: join(cwd, ".aligntrue", "config.yaml"),

    /** Path to rules markdown file: .aligntrue/rules.md */
    rules: join(cwd, ".aligntrue", "rules.md"),

    /** Path to lockfile: .aligntrue.lock.json */
    lockfile: join(cwd, ".aligntrue.lock.json"),

    /** Path to bundle file: .aligntrue.bundle.yaml */
    bundle: join(cwd, ".aligntrue.bundle.yaml"),

    /** Path to Cursor rule file for given scope */
    cursorRules: (scope: string): string => {
      // Normalize scope: convert slashes to hyphens, default to 'aligntrue'
      const filename =
        scope === "default" ? "aligntrue" : scope.replace(/\//g, "-");
      return join(cwd, ".cursor", "rules", `${filename}.mdc`);
    },

    /** Path to AGENTS.md universal format file */
    agentsMd: (): string => join(cwd, "AGENTS.md"),

    /** Path to VS Code MCP config file */
    vscodeMcp: (): string => join(cwd, ".vscode", "mcp.json"),

    /** Path to cache directory for given type (catalog, git, etc.) */
    cache: (type: string): string => join(cwd, ".aligntrue", ".cache", type),

    /** Path to privacy consent storage */
    privacyConsent: (): string =>
      join(cwd, ".aligntrue", "privacy-consent.json"),

    /** Path to telemetry events storage */
    telemetryEvents: (): string =>
      join(cwd, ".aligntrue", "telemetry-events.json"),

    /** Path to .aligntrue directory */
    aligntrueDir: join(cwd, ".aligntrue"),

    /** Path to specific exporter output (generic helper) */
    exporterOutput: (exporterName: string, filename: string): string => {
      // Map common exporter names to their output directories
      const dirMap: Record<string, string> = {
        cursor: ".cursor/rules",
        "vscode-mcp": ".vscode",
        "cursor-mcp": ".cursor",
        amazonq: ".amazonq/rules",
        augmentcode: ".augment/rules",
        kilocode: ".kilocode/rules",
        kiro: ".kiro/steering",
        "firebase-studio": ".idx",
        junie: ".junie",
        "trae-ai": ".trae/rules",
        openhands: ".openhands/microagents",
      };

      const dir = dirMap[exporterName] || ".";
      return join(cwd, dir, filename);
    },
  };
}

/**
 * Get .aligntrue directory path
 *
 * @param cwd - Current working directory (default: process.cwd())
 * @returns Path to .aligntrue directory
 */
export function getAlignTrueDir(cwd: string = process.cwd()): string {
  return join(cwd, ".aligntrue");
}

/**
 * Get cache directory path for a specific provider type
 *
 * @param type - Cache type (catalog, git, etc.)
 * @param cwd - Current working directory (default: process.cwd())
 * @returns Path to cache directory
 */
export function getCacheDir(type: string, cwd: string = process.cwd()): string {
  return join(cwd, ".aligntrue", ".cache", type);
}
