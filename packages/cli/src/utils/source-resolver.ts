/**
 * Source resolver - handles fetching from local, git, and url sources
 */

import { existsSync } from "fs";
import { resolve, extname } from "path";
import { GitProvider, LocalProvider, detectRefType } from "@aligntrue/sources";
import {
  mergePacks,
  type BundleResult,
  ensureSectionsArray,
} from "@aligntrue/core";
import { parseNaturalMarkdown } from "@aligntrue/core/parsing/natural-markdown";
import { parseYamlToJson, type AlignPack } from "@aligntrue/schema";
import type { AlignTrueConfig, ConsentManager } from "@aligntrue/core";
import type { GitProgressUpdate } from "./git-progress.js";

export interface ResolvedSource {
  content: string;
  sourcePath: string;
  sourceType: "local" | "git" | "url";
  commitSha?: string; // For git sources
}

type GitProviderCtorOptions = {
  offlineMode?: boolean;
  consentManager?: ConsentManager;
  mode?: "solo" | "team" | "enterprise";
  maxFileSizeMb?: number;
  force?: boolean;
  checkInterval?: number;
  onProgress?: (update: GitProgressUpdate) => void;
};

/**
 * Parse source content into AlignPack based on file extension
 * Handles both YAML and markdown with frontmatter
 */
function parseSourceContent(content: string, sourcePath: string): AlignPack {
  const ext = extname(sourcePath).toLowerCase();

  if (ext === ".md" || ext === ".markdown") {
    // Parse markdown with optional YAML frontmatter
    const parsed = parseNaturalMarkdown(content);

    // Convert to AlignPack format
    return {
      id: parsed.metadata.id || "imported-pack",
      version: parsed.metadata.version || "1.0.0",
      spec_version: "1",
      sections: parsed.sections,
    };
  } else {
    // Parse as YAML
    return parseYamlToJson(content) as AlignPack;
  }
}

/**
 * Resolve a single source from config
 * Handles local files, git repositories, and URLs
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
  const config = options?.config;

  if (!source) {
    throw new Error("Source configuration is required");
  }

  // Handle local sources
  if (source.type === "local") {
    if (!source.path) {
      throw new Error('Local source requires "path" field');
    }

    const resolvedPath = resolve(cwd, source.path);

    if (!existsSync(resolvedPath)) {
      throw new Error(
        `Source file not found: ${source.path}\n` +
          `  Resolved path: ${resolvedPath}\n` +
          `  Check that the file exists and the path is correct.`,
      );
    }

    // LocalProvider expects a base path and fetches relative to it
    // For single file sources, use the parent directory as base
    const { dirname, basename } = await import("path");
    const baseDir = dirname(resolvedPath);
    const fileName = basename(resolvedPath);

    const provider = new LocalProvider(baseDir);
    const content = await provider.fetch(fileName);

    return {
      content,
      sourcePath: source.path,
      sourceType: "local",
    };
  }

  // Handle git sources
  if (source.type === "git") {
    if (!source.url) {
      throw new Error('Git source requires "url" field');
    }

    const cacheDir = resolve(cwd, ".aligntrue/.cache/git");

    // Determine check interval based on ref type and config
    let checkInterval: number | undefined;
    const sourceWithInterval = source as typeof source & {
      check_interval?: number;
    };
    if (sourceWithInterval.check_interval) {
      // Per-source override
      checkInterval = sourceWithInterval.check_interval;
    } else if (config?.git) {
      // Use global config based on ref type
      const gitConfigWithIntervals = config.git as typeof config.git & {
        branch_check_interval?: number;
        tag_check_interval?: number;
      };
      const refType = source.ref ? detectRefType(source.ref) : "branch";
      if (refType === "branch") {
        checkInterval = gitConfigWithIntervals.branch_check_interval ?? 86400;
      } else if (refType === "tag") {
        checkInterval = gitConfigWithIntervals.tag_check_interval ?? 604800;
      }
      // commits never check, so no interval needed
    }

    const gitConfig: {
      type: "git";
      url: string;
      ref?: string;
      path?: string;
      forceRefresh?: boolean;
      checkInterval?: number;
    } = {
      type: "git",
      url: source.url,
      forceRefresh,
    };

    if (checkInterval !== undefined) {
      gitConfig.checkInterval = checkInterval;
    }

    if (source.ref) {
      gitConfig.ref = source.ref;
    }
    if (source.path) {
      gitConfig.path = source.path;
    }

    const providerOptions: GitProviderCtorOptions = {
      offlineMode,
      mode: config?.mode ?? "solo",
    };

    if (options?.onGitProgress) {
      providerOptions.onProgress = options.onGitProgress;
    }

    const provider = new GitProvider(gitConfig, cacheDir, providerOptions);

    const content = await provider.fetch();
    const commitSha = await provider.getCommitSha();

    return {
      content,
      sourcePath: `${source.url}${source.path ? `/${source.path}` : ""}`,
      sourceType: "git",
      commitSha,
    };
  }

  // Handle URL sources (future)
  if (source.type === "url") {
    throw new Error(
      "URL sources not yet implemented\n" +
        `  URL: ${source.url}\n` +
        `  Use git sources for now: type: git, url: <repo-url>`,
    );
  }

  throw new Error(`Unknown source type: ${(source as { type?: string }).type}`);
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
  const sources = config.sources || [
    { type: "local" as const, path: ".aligntrue/.rules.yaml" },
  ];

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

  // If only one source, no merging needed
  if (resolved.length === 1) {
    const firstSource = resolved[0];
    if (!firstSource) {
      throw new Error("First resolved source is undefined");
    }
    const pack = parseSourceContent(
      firstSource.content,
      firstSource.sourcePath,
    );
    // Defensive: Initialize sections to empty array ONLY if missing or invalid
    try {
      ensureSectionsArray(pack, { throwOnInvalid: true });
    } catch {
      throw new Error(
        `Invalid pack format: sections must be an array, got ${typeof pack.sections}\n` +
          `  Source: ${firstSource.sourcePath}`,
      );
    }
    return {
      pack,
      conflicts: [],
      warnings: [],
      sources: resolved,
    };
  }

  // Parse all sources into AlignPacks
  const packs: AlignPack[] = [];
  for (const source of resolved) {
    try {
      const pack = parseSourceContent(source.content, source.sourcePath);
      // Defensive: Initialize sections to empty array ONLY if missing or invalid
      try {
        ensureSectionsArray(pack, { throwOnInvalid: true });
      } catch {
        throw new Error(
          `Invalid pack format: sections must be an array, got ${typeof pack.sections}\n` +
            `  Source: ${source.sourcePath}`,
        );
      }
      packs.push(pack);
    } catch (error) {
      throw new Error(
        `Failed to parse source as AlignPack\n` +
          `  Source: ${source.sourcePath}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Merge packs
  // Always preserve IDs from existing packs, never use generic "merged-bundle"
  // This ensures project IDs from init are preserved across sync operations
  const bundleResult = mergePacks(packs, {
    warnConflicts: options?.warnConflicts ?? true,
    bundleId: packs[0]?.id || "bundle",
    bundleVersion: "1.0.0",
  });

  return {
    ...bundleResult,
    sources: resolved,
  };
}
