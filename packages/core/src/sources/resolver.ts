/**
 * Unified source resolver for local sources
 *
 * Provides consistent behavior for local source types:
 * - Auto-detects source type (git, URL, local)
 * - Supports both files and directories
 * - Scans directories recursively for .md and .mdc files
 * - Converts .mdc to .md format
 * - Preserves directory structure
 * - Returns RuleFile[] consistently
 *
 * NOTE: Git source resolution is handled by @aligntrue/cli.
 * This keeps @aligntrue/core as a pure library with no optional peer dependencies.
 */

import { existsSync, statSync } from "fs";
import { join, resolve } from "path";
import type { RuleFile } from "@aligntrue/schema";
import { loadRulesDirectory } from "../rules/file-io.js";
import { parseSourceUrl } from "../import/source-detector.js";

/**
 * Options for resolving a source
 */
export interface ResolveSourceOptions {
  /** Current working directory */
  cwd?: string | undefined;
  /** Offline mode - use cache only, no network operations (unused for local sources) */
  offlineMode?: boolean | undefined;
  /** Force refresh - bypass cache and re-fetch (unused for local sources) */
  forceRefresh?: boolean | undefined;
  /** Progress callback for long operations */
  onProgress?: ((message: string) => void) | undefined;
}

/**
 * Result of resolving a source
 */
export interface ResolvedSource {
  /** Parsed rules from the source */
  rules: RuleFile[];
  /** Source URL or path */
  sourceUrl: string;
  /** Resolved commit SHA (for git sources) */
  commitSha?: string;
  /** Whether source was resolved from cache (not fetched) */
  fromCache: boolean;
}

/**
 * Resolve a source and return parsed rules
 *
 * Supports:
 * - Git repositories (GitHub, GitLab, etc.) with optional ref and path
 * - HTTP/HTTPS URLs to single files or directories
 * - Local file paths (absolute or relative)
 *
 * For git and URL sources targeting directories, recursively finds all .md and .mdc files.
 * For single file sources, returns that file as a single rule.
 *
 * @param source - Source URL, path, or git URL with optional @ref and /path
 * @param options - Resolution options
 * @returns Resolved rules and metadata
 */
export async function resolveSource(
  source: string,
  options?: ResolveSourceOptions,
): Promise<ResolvedSource> {
  const cwd = options?.cwd ?? process.cwd();
  const parsed = parseSourceUrl(source);

  // Progress callback
  const onProgress = options?.onProgress;
  const log = (msg: string) => onProgress?.(msg);

  switch (parsed.type) {
    case "local":
      log?.(`Resolving local source: ${source}`);
      return await resolveLocalSource(source, cwd, options);

    case "git":
      throw new Error(
        `Git source resolution is not available in @aligntrue/core.\n` +
          `Use @aligntrue/cli for git sources. The CLI package includes full git support.`,
      );

    default:
      throw new Error(`Unknown source type for: ${source}`);
  }
}

/**
 * Resolve a local source (file or directory)
 */
async function resolveLocalSource(
  source: string,
  cwd: string,
  _options?: ResolveSourceOptions,
): Promise<ResolvedSource> {
  let fullPath = resolve(cwd, source);

  // Smart path resolution: if path starts with "/" and doesn't exist as absolute,
  // try treating it as workspace-relative (common user expectation)
  // e.g., "/apps/docs" in workspace "/Users/me/project" -> "/Users/me/project/apps/docs"
  if (source.startsWith("/") && !existsSync(fullPath)) {
    const workspaceRelative = join(cwd, source);
    if (existsSync(workspaceRelative)) {
      fullPath = workspaceRelative;
    }
  }

  if (!existsSync(fullPath)) {
    throw new Error(
      `Local source not found at ${fullPath}. Verify the path exists or try a URL source. ` +
        `Supported formats: GitHub/GitLab URLs (https://github.com/org/repo), SSH URLs (git@github.com:org/repo.git), git refs (@v1.0.0), and local paths (./rules or /absolute/path). ` +
        `See 'aligntrue init --help' or https://aligntrue.ai/add-rules`,
    );
  }

  const stat = statSync(fullPath);

  if (stat.isFile()) {
    // Single file - parse and return
    const { parseRuleFile } = await import("../rules/file-io.js");
    const rule = parseRuleFile(fullPath, cwd);
    return {
      rules: rule ? [rule] : [],
      sourceUrl: source,
      fromCache: true,
    };
  }

  if (stat.isDirectory()) {
    // Directory - load all rules recursively
    const rules = await loadRulesDirectory(fullPath, cwd, { recursive: true });
    return {
      rules,
      sourceUrl: source,
      fromCache: true,
    };
  }

  throw new Error(`Invalid local source: ${fullPath}`);
}
