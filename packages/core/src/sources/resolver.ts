/**
 * Unified source resolver for all source types (git, URL, local)
 *
 * Provides consistent behavior across all source types:
 * - Auto-detects source type (git, URL, local)
 * - Handles cloning/fetching/caching transparently
 * - Supports both files and directories
 * - Scans directories recursively for .md and .mdc files
 * - Converts .mdc to .md format
 * - Preserves directory structure
 * - Returns RuleFile[] consistently
 */

import { existsSync, statSync } from "fs";
import { join, resolve } from "path";
import type { RuleFile } from "@aligntrue/schema";
import { loadRulesDirectory } from "../rules/file-io.js";
import { parseSourceUrl } from "../import/source-detector.js";
import type { ConsentManager } from "../privacy/index.js";

/**
 * Options for resolving a source
 */
export interface ResolveSourceOptions {
  /** Current working directory */
  cwd?: string | undefined;
  /** Offline mode - use cache only, no network operations */
  offlineMode?: boolean | undefined;
  /** Force refresh - bypass cache and re-fetch */
  forceRefresh?: boolean | undefined;
  /** Consent manager for network operations */
  consentManager?: ConsentManager | undefined;
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
      log?.(`Resolving git source: ${source}`);
      return await resolveGitSource(source, parsed, cwd, options);

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
  const fullPath = resolve(cwd, source);

  if (!existsSync(fullPath)) {
    throw new Error(`Local source not found: ${fullPath}`);
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

/**
 * Resolve a git source using GitProvider
 */
async function resolveGitSource(
  source: string,
  parsed: ReturnType<typeof parseSourceUrl>,
  cwd: string,
  options?: ResolveSourceOptions,
): Promise<ResolvedSource> {
  // Dynamic import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GitProvider: any;
  try {
    const importDynamic = new Function("specifier", "return import(specifier)");
    const sourcesModule = await importDynamic("@aligntrue/sources");
    GitProvider = sourcesModule.GitProvider;
  } catch {
    throw new Error(
      "Git source resolution requires @aligntrue/sources package. Install it with: pnpm add @aligntrue/sources",
    );
  }

  const cacheDir = resolve(cwd, ".aligntrue", ".cache", "git");
  const gitRef = parsed.ref ?? "main";
  const gitPath = parsed.path ?? "";

  const provider = new GitProvider(
    {
      type: "git",
      url: parsed.url,
      ref: gitRef,
      path: gitPath || ".",
      forceRefresh: options?.forceRefresh,
    },
    cacheDir,
    {
      offlineMode: options?.offlineMode,
      consentManager: options?.consentManager,
    },
  );

  // Fetch repository (clone or update)
  options?.onProgress?.(`Fetching git repository: ${parsed.url}@${gitRef}`);
  await provider.fetch(gitRef);
  const commitSha = await provider.getCommitSha();

  // Get cached repo directory
  const { computeHash } = await import("@aligntrue/schema");
  const repoHash = computeHash(parsed.url).substring(0, 16);
  const repoDir = join(cacheDir, repoHash);

  if (!existsSync(repoDir)) {
    throw new Error(`Failed to fetch repository: ${parsed.url}`);
  }

  // Determine target path within repo
  const targetPath = gitPath ? join(repoDir, gitPath) : repoDir;

  if (!existsSync(targetPath)) {
    throw new Error(
      `Path not found in repository: ${gitPath || "root"}\n` +
        `  Repository: ${parsed.url}\n` +
        `  Path: ${targetPath}`,
    );
  }

  const stat = statSync(targetPath);

  // Load rules from target
  let rules: RuleFile[] = [];
  if (stat.isFile()) {
    // Single file
    const { parseRuleFile } = await import("../rules/file-io.js");
    const rule = parseRuleFile(targetPath, cwd, source);
    rules = rule ? [rule] : [];
  } else if (stat.isDirectory()) {
    // Directory - load all rules recursively
    rules = await loadRulesDirectory(targetPath, cwd, { recursive: true });
  }

  return {
    rules,
    sourceUrl: source,
    commitSha,
    fromCache: false,
  };
}
