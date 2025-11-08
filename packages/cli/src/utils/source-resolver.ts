/**
 * Source resolver - handles fetching from local, git, and url sources
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { GitProvider, LocalProvider } from "@aligntrue/sources";
import { mergePacks, type BundleResult } from "@aligntrue/core";
import { parseYamlToJson, type AlignPack } from "@aligntrue/schema";
import type { AlignTrueConfig } from "@aligntrue/core";

export interface ResolvedSource {
  content: string;
  sourcePath: string;
  sourceType: "local" | "git" | "url";
  commitSha?: string; // For git sources
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
  },
): Promise<ResolvedSource> {
  const cwd = options?.cwd || process.cwd();
  const offlineMode = options?.offlineMode || false;

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
    const gitConfig: {
      type: "git";
      url: string;
      ref?: string;
      path?: string;
    } = {
      type: "git",
      url: source.url,
    };

    if (source.ref) {
      gitConfig.ref = source.ref;
    }
    if (source.path) {
      gitConfig.path = source.path;
    }

    const provider = new GitProvider(gitConfig, cacheDir, {
      offlineMode,
      mode: "solo", // TODO: Get from config
    });

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
  },
): Promise<ResolvedSource[]> {
  const sources = config.sources || [
    { type: "local" as const, path: ".aligntrue/.rules.yaml" },
  ];

  const resolved: ResolvedSource[] = [];

  for (const source of sources) {
    try {
      const resolvedSource = await resolveSource(source, options);
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
    warnConflicts?: boolean;
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
    const pack = parseYamlToJson(firstSource.content) as AlignPack;
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
      const pack = parseYamlToJson(source.content) as AlignPack;
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
  const bundleResult = mergePacks(packs, {
    warnConflicts: options?.warnConflicts ?? true,
    bundleId: "merged-bundle",
    bundleVersion: "1.0.0",
  });

  return {
    ...bundleResult,
    sources: resolved,
  };
}
