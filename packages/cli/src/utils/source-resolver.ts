/**
 * Source resolver for CLI sync operations
 *
 * Handles all source types:
 * - Local sources: delegated to @aligntrue/core
 * - Git sources: resolved directly using @aligntrue/sources (GitProvider)
 *
 * This keeps @aligntrue/core as a pure library without dynamic imports.
 */

import { existsSync, statSync } from "fs";
import { basename, join, resolve } from "path";
import matter from "gray-matter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  resolveSource as coreResolveSource,
  mergeAligns,
  type BundleResult,
  ensureSectionsArray,
  parseSourceURL,
  loadRulesDirectory,
  parseRuleFile,
  detectConflicts,
  logImport,
  type ConflictInfo,
} from "@aligntrue/core";
import {
  computeContentHash,
  computeHash,
  type Align,
  type RuleFile,
  type RuleFrontmatter,
} from "@aligntrue/schema";
import type { AlignTrueConfig } from "@aligntrue/core";
import { GitProvider, resolvePackFromGithub } from "@aligntrue/sources";
import type { GitProgressUpdate } from "./git-progress.js";

/**
 * Internal resolved source from git or local resolution
 * (matches core's ResolvedSource interface)
 */
interface InternalResolvedSource {
  rules: RuleFile[];
  sourceUrl: string;
  commitSha?: string;
  fromCache: boolean;
}

/**
 * Resolve a git source using GitProvider
 * This is the git resolution logic moved from @aligntrue/core to CLI
 * to eliminate the dynamic import security issue in core.
 */
async function resolveGitSourceInternal(
  source: string,
  parsed: { type: string; url: string; ref?: string; path?: string },
  cwd: string,
  options?: {
    offlineMode?: boolean;
    forceRefresh?: boolean;
    onProgress?: (message: string) => void;
    mode?: "solo" | "team" | "enterprise";
    personal?: boolean;
  },
): Promise<InternalResolvedSource> {
  const cacheDir = resolve(cwd, ".aligntrue", ".cache", "git");
  const gitRef = parsed.ref ?? "main";
  const gitPath = parsed.path ?? "";

  const gitConfig: {
    type: "git";
    url: string;
    ref: string;
    path: string;
    forceRefresh?: boolean;
    personal?: boolean;
  } = {
    type: "git",
    url: parsed.url,
    ref: gitRef,
    path: gitPath || ".",
  };
  if (options?.forceRefresh !== undefined) {
    gitConfig.forceRefresh = options.forceRefresh;
  }
  if (options?.personal !== undefined) {
    gitConfig.personal = options.personal;
  }

  const providerOptions: {
    offlineMode?: boolean;
    mode?: "solo" | "team" | "enterprise";
  } = {};
  if (options?.offlineMode !== undefined) {
    providerOptions.offlineMode = options.offlineMode;
  }
  if (options?.mode !== undefined) {
    providerOptions.mode = options.mode;
  }

  const provider = new GitProvider(gitConfig, cacheDir, providerOptions);

  // Fetch repository (clone or update)
  options?.onProgress?.(`Fetching git repository: ${parsed.url}@${gitRef}`);
  await provider.fetch(gitRef);
  const commitSha = await provider.getCommitSha();

  // Get cached repo directory
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

/**
 * Detect if a source URL is a git source
 */
function isGitSource(sourceUrl: string): boolean {
  // Git SSH URLs
  if (sourceUrl.startsWith("git@")) return true;
  // SSH URLs
  if (sourceUrl.startsWith("ssh://")) return true;
  // Explicit .git suffix
  if (sourceUrl.endsWith(".git")) return true;

  // Check for known git hosting URLs
  try {
    const urlObj = new URL(sourceUrl);
    const hostname = urlObj.hostname;
    if (
      hostname === "github.com" ||
      hostname.endsWith(".github.com") ||
      hostname === "gitlab.com" ||
      hostname.endsWith(".gitlab.com") ||
      hostname === "bitbucket.org" ||
      hostname.endsWith(".bitbucket.org")
    ) {
      return true;
    }
  } catch {
    // Not a valid URL
  }

  return false;
}

/**
 * Parse a git URL to extract components
 */
function parseGitUrlComponents(source: string): {
  type: "git";
  url: string;
  ref?: string;
  path?: string;
} {
  // Use parseSourceURL for full parsing
  const parsed = parseSourceURL(source);
  const result: {
    type: "git";
    url: string;
    ref?: string;
    path?: string;
  } = {
    type: "git",
    url: `https://${parsed.host}/${parsed.org}/${parsed.repo}`,
  };
  if (parsed.ref) {
    result.ref = parsed.ref;
  }
  if (parsed.path) {
    result.path = parsed.path;
  }
  return result;
}

const matterOptions = {
  engines: {
    yaml: {
      parse: (str: string) => parseYaml(str) as object,
      stringify: (obj: object) => stringifyYaml(obj),
    },
  },
};

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.(md|mdc)$/i, "");
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function ruleFromPackFile(file: { path: string; content: string }): RuleFile {
  const parsed = matter(file.content, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;
  const filename = basename(file.path);

  const finalFrontmatter: RuleFrontmatter = {
    ...frontmatter,
    title: frontmatter.title || titleFromFilename(filename),
  };

  return {
    content: parsed.content,
    frontmatter: finalFrontmatter,
    path: file.path,
    filename,
    relativePath: file.path,
    hash: computeContentHash(file.content),
  };
}

async function tryResolvePackSource(
  source: string,
  ref: string | undefined,
): Promise<InternalResolvedSource | null> {
  try {
    const pack = await resolvePackFromGithub(source, ref ? { ref } : {});
    const rules = pack.files.map((file) =>
      ruleFromPackFile({ path: file.path, content: file.content }),
    );

    return {
      rules,
      sourceUrl: source,
      fromCache: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (
      lower.includes("no .align.yaml") ||
      lower.includes("manifest not found")
    ) {
      return null;
    }
    if (message.includes("Only GitHub is supported")) {
      return null;
    }
    throw error;
  }
}

export interface ResolvedSource {
  align: Align;
  sourcePath: string;
  sourceType: "local" | "git";
  commitSha?: string | undefined; // For git sources
}

/**
 * Normalize a fingerprint to schema-safe format (lowercase a-z0-9- only)
 */
function normalizeFingerprint(raw: string): string {
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > 0) {
    return slug;
  }

  // Fallback to stable hash slice if slug is empty after normalization
  return computeHash(raw).slice(0, 16);
}

// Exported for tests only
export const __normalizeFingerprintForTests = normalizeFingerprint;

/**
 * Resolve a single source from config
 * Uses unified SourceResolver to fetch rules, converts to Align format
 */
export async function resolveSource(
  source: NonNullable<AlignTrueConfig["sources"]>[0],
  options?: {
    cwd?: string;
    offlineMode?: boolean;
    forceRefresh?: boolean;
    config?: AlignTrueConfig;
    onGitProgress?: (update: GitProgressUpdate) => void;
  },
): Promise<ResolvedSource> {
  const cwd = options?.cwd || process.cwd();
  const offlineMode = options?.offlineMode || false;
  const forceRefresh = options?.forceRefresh || false;
  const mode = options?.config?.mode || "solo";

  if (!source) {
    throw new Error("Source configuration is required");
  }

  // Build source URL string from config
  let sourceUrl = "";
  let sourcePath = "";
  if (source.type === "local" && source.path) {
    sourceUrl = source.path;
  } else if (source.type === "git" && source.url) {
    sourceUrl = source.url;
    if (source.ref) {
      sourceUrl += `@${source.ref}`;
    }
    if (source.path) {
      sourcePath = source.path;
    }
  }

  // Progress callback wrapper
  const onProgress = options?.onGitProgress
    ? (msg: string) => {
        options.onGitProgress?.({
          phase: "metadata",
          message: msg,
          repo: sourceUrl,
        });
      }
    : undefined;

  // Resolve source - handle git sources locally, delegate local sources to core
  let resolved: InternalResolvedSource;

  // Build options object avoiding undefined values for exactOptionalPropertyTypes
  const resolveOpts: {
    offlineMode?: boolean;
    forceRefresh?: boolean;
    onProgress?: (message: string) => void;
    mode?: "solo" | "team" | "enterprise";
    personal?: boolean;
  } = {};
  if (offlineMode) {
    resolveOpts.offlineMode = offlineMode;
  }
  if (forceRefresh) {
    resolveOpts.forceRefresh = forceRefresh;
  }
  if (onProgress) {
    resolveOpts.onProgress = onProgress;
  }
  if (mode) {
    resolveOpts.mode = mode;
  }
  // Pass personal flag from source config
  if (source.personal !== undefined) {
    resolveOpts.personal = source.personal;
  }

  if (source.type === "git" || isGitSource(sourceUrl)) {
    // Git source: resolve directly using GitProvider (CLI has @aligntrue/sources)
    const parsed = parseGitUrlComponents(sourceUrl);
    if (sourcePath) {
      parsed.path = sourcePath;
    }
    resolved = await resolveGitSourceInternal(
      sourceUrl,
      parsed,
      cwd,
      resolveOpts,
    );
  } else {
    // Local source: delegate to core resolver
    resolved = await coreResolveSource(sourceUrl, {
      cwd,
      ...resolveOpts,
    });
  }

  // Convert rules to Align format for merging
  // Use filename-based fingerprint (matching ir-loader.ts) for consistency
  // This ensures drift detection uses the same fingerprints as sync
  const sections = resolved.rules.map((rule: RuleFile) => {
    // Extract scope from frontmatter if it's a valid approval scope
    // Valid scopes: "team" (default), "personal" (excluded from lockfile), "shared"
    const frontmatterScope = rule.frontmatter.scope;
    let approvalScope: "team" | "personal" | "shared" | undefined;

    if (
      frontmatterScope === "personal" ||
      frontmatterScope === "team" ||
      frontmatterScope === "shared"
    ) {
      // Explicit scope in frontmatter takes precedence
      approvalScope = frontmatterScope as "team" | "personal" | "shared";
    } else if (source.personal === true) {
      // Bug fix: Use source.personal as fallback default
      // Per docs: "personal: true on a source marks all rules from that source as scope: personal"
      approvalScope = "personal";
    }

    return {
      heading: rule.frontmatter.title || rule.filename.replace(/\.md$/, ""),
      content: rule.content,
      level: 2, // Schema requires level 2-6 (## through ######)
      fingerprint: normalizeFingerprint(
        ((rule.frontmatter as Record<string, unknown>)["id"] as string) ||
          rule.filename.replace(/\.md$/, ""),
      ),
      source_file: rule.path,
      // Store frontmatter in vendor.aligntrue for export fidelity (not directly on section)
      vendor: {
        aligntrue: {
          frontmatter: rule.frontmatter,
        },
      },
      // Only include scope if it's a valid approval scope (exactOptionalPropertyTypes requires this)
      ...(approvalScope && { scope: approvalScope }),
    };
  });

  // Return Align directly - no YAML serialization needed
  const align: Align = {
    id: source.type === "local" ? "local-rules" : "imported-align",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  return {
    align,
    sourcePath: sourceUrl,
    sourceType: source.type,
    commitSha: resolved.commitSha,
  };
}

/**
 * Expand sources with include arrays into individual source items
 * Converts include URLs into separate git sources, one per URL
 */
function expandSourcesWithInclude(
  sources: NonNullable<AlignTrueConfig["sources"]>,
): NonNullable<AlignTrueConfig["sources"]> {
  const expanded: NonNullable<AlignTrueConfig["sources"]> = [];

  for (const source of sources) {
    if (!source) continue;

    // If source has include array, expand it
    const sourceWithInclude = source as {
      type?: string;
      include?: string[];
      url?: string;
      path?: string;
      ref?: string;
    };

    if (sourceWithInclude.type === "git" && sourceWithInclude.include) {
      // Expand each include URL into a separate source
      for (const includeUrl of sourceWithInclude.include) {
        try {
          const parsed = parseSourceURL(includeUrl);
          // Create a new git source from the parsed URL
          const expandedSource: {
            type: "git" | "local";
            url?: string;
            path?: string;
            ref?: string;
          } = {
            type: "git",
            url: `https://${parsed.host}/${parsed.org}/${parsed.repo}`,
          };
          if (parsed.ref) {
            expandedSource.ref = parsed.ref;
          }
          if (parsed.path) {
            expandedSource.path = parsed.path;
          }
          expanded.push(
            expandedSource as NonNullable<AlignTrueConfig["sources"]>[0],
          );
        } catch (error) {
          throw new Error(
            `Failed to parse include URL: ${includeUrl}\n` +
              `  ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else {
      // Keep non-include sources as-is
      expanded.push(source);
    }
  }

  return expanded;
}

/**
 * Resolve all sources from config
 * Returns array of resolved sources in order
 */
export async function resolveSources(
  config: AlignTrueConfig,
  options?: {
    cwd?: string;
    offlineMode?: boolean;
    forceRefresh?: boolean;
    onGitProgress?: (update: GitProgressUpdate) => void;
  },
): Promise<ResolvedSource[]> {
  let sources = config.sources || [
    { type: "local" as const, path: ".aligntrue/rules" },
  ];

  // Expand any sources with include arrays
  sources = expandSourcesWithInclude(sources);

  const resolved: ResolvedSource[] = [];

  for (const source of sources) {
    try {
      const resolvedSource = await resolveSource(source, {
        ...options,
        config,
      });
      resolved.push(resolvedSource);
    } catch (error) {
      throw new Error(
        `Failed to resolve source\n` +
          `  Type: ${source.type}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return resolved;
}

/**
 * Resolve and merge all sources from config into a single bundle
 *
 * @param config - AlignTrue configuration
 * @param options - Resolution options
 * @returns Merged bundle with conflict information
 */
export async function resolveAndMergeSources(
  config: AlignTrueConfig,
  options?: {
    cwd?: string;
    offlineMode?: boolean;
    forceRefresh?: boolean;
    warnConflicts?: boolean;
    onGitProgress?: (update: GitProgressUpdate) => void;
  },
): Promise<BundleResult & { sources: ResolvedSource[] }> {
  // Resolve all sources
  const resolved = await resolveSources(config, options);

  // Deduplicate identical resolved sources (same path/ref/type) to avoid
  // self-conflict noise when the same source is listed twice
  const resolvedUnique = resolved.filter((src, idx, arr) => {
    return (
      arr.findIndex(
        (other) =>
          other.sourcePath === src.sourcePath &&
          other.sourceType === src.sourceType &&
          other.commitSha === src.commitSha,
      ) === idx
    );
  });

  // If only one source, no merging needed
  if (resolvedUnique.length === 1) {
    const firstSource = resolvedUnique[0];
    if (!firstSource) {
      throw new Error("First resolved source is undefined");
    }
    // Use align directly - no parsing needed
    const align = firstSource.align;
    // Defensive: Initialize sections to empty array ONLY if missing or invalid
    try {
      ensureSectionsArray(align, { throwOnInvalid: true });
    } catch {
      throw new Error(
        `Invalid align format: sections must be an array, got ${typeof align.sections}\n` +
          `  Source: ${firstSource.sourcePath}`,
      );
    }
    return {
      align,
      conflicts: [],
      warnings: [],
      sources: resolvedUnique,
    };
  }

  // Use aligns directly from resolved sources - no parsing needed
  const aligns: Align[] = [];
  for (const source of resolvedUnique) {
    const align = source.align;
    // Defensive: Initialize sections to empty array ONLY if missing or invalid
    try {
      ensureSectionsArray(align, { throwOnInvalid: true });
    } catch {
      throw new Error(
        `Invalid align format: sections must be an array, got ${typeof align.sections}\n` +
          `  Source: ${source.sourcePath}`,
      );
    }
    aligns.push(align);
  }

  // Merge aligns
  // Always preserve IDs from existing aligns, never use generic "merged-bundle"
  // This ensures project IDs from init are preserved across sync operations
  const bundleResult = mergeAligns(aligns, {
    warnConflicts: options?.warnConflicts ?? true,
    bundleId: aligns[0]?.id || "bundle",
    bundleVersion: "1.0.0",
  });

  return {
    ...bundleResult,
    sources: resolvedUnique,
  };
}

/**
 * Options for importing rules (matches core's ImportOptions)
 */
export interface ImportOptions {
  /** Source URL, path, or git URL */
  source: string;
  /** Git ref (branch/tag/commit) - only for git sources */
  ref?: string | undefined;
  /** Target directory for imported rules (e.g., .aligntrue/rules) */
  targetDir: string;
  /** Current working directory */
  cwd?: string | undefined;
  /** Offline mode - use cache only, no network operations */
  offlineMode?: boolean | undefined;
  /** Force refresh - bypass cache and re-fetch */
  forceRefresh?: boolean | undefined;
  /** Progress callback for long operations */
  onProgress?: ((message: string) => void) | undefined;
}

/**
 * Result of importing rules (matches core's ImportResult)
 */
export interface ImportResult {
  /** Successfully parsed rules */
  rules: RuleFile[];
  /** Conflicts with existing rules */
  conflicts: ConflictInfo[];
  /** Source URL/path */
  source: string;
  /** Detected source type */
  sourceType: "git" | "local";
  /** Error message if import failed */
  error?: string;
}

/**
 * Import rules from a source (CLI version with git support)
 *
 * This is the CLI-level wrapper that handles git sources directly,
 * keeping @aligntrue/core as a pure library without dynamic imports.
 *
 * @param options - Import options
 * @returns Import result with rules and any conflicts
 */
export async function importRules(
  options: ImportOptions,
): Promise<ImportResult> {
  const { source, cwd = process.cwd(), targetDir, ref } = options;

  // Build full source URL with ref if provided
  let fullSource = source;
  if (ref && isGitSource(source) && !source.includes("@")) {
    fullSource = `${source}@${ref}`;
  }

  // Detect source type
  const sourceType = isGitSource(fullSource) ? "git" : "local";

  try {
    // Resolve source using CLI's resolver (handles both git and local)
    let resolved: InternalResolvedSource;

    // Build options object avoiding undefined values for exactOptionalPropertyTypes
    const importResolveOpts: {
      offlineMode?: boolean;
      forceRefresh?: boolean;
      onProgress?: (message: string) => void;
    } = {};
    if (options.offlineMode !== undefined) {
      importResolveOpts.offlineMode = options.offlineMode;
    }
    if (options.forceRefresh !== undefined) {
      importResolveOpts.forceRefresh = options.forceRefresh;
    }
    if (options.onProgress !== undefined) {
      importResolveOpts.onProgress = options.onProgress;
    }

    if (sourceType === "git") {
      const packResolved = await tryResolvePackSource(fullSource, ref);
      if (packResolved) {
        resolved = packResolved;
      } else {
        const parsed = parseGitUrlComponents(fullSource);
        resolved = await resolveGitSourceInternal(
          fullSource,
          parsed,
          cwd,
          importResolveOpts,
        );
      }
    } else {
      resolved = await coreResolveSource(fullSource, {
        cwd,
        ...importResolveOpts,
      });
    }

    const rules = resolved.rules;

    // Log import events to audit log (instead of storing in frontmatter)
    for (const rule of rules) {
      logImport(cwd, rule.filename, source);
    }

    // Detect conflicts with existing rules
    const conflicts = detectConflicts(
      rules.map((r) => ({
        filename: r.filename,
        title: r.frontmatter.title || r.filename,
        source,
      })),
      targetDir,
    );

    return {
      rules,
      conflicts,
      source,
      sourceType,
    };
  } catch (error) {
    return {
      rules: [],
      conflicts: [],
      source,
      sourceType,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
