/**
 * Source resolver for CLI sync operations
 *
 * Uses the unified SourceResolver from @aligntrue/core to fetch rules,
 * then converts them to Align format for merging during sync.
 */

import { extname } from "path";
import {
  resolveSource as coreResolveSource,
  mergeAligns,
  type BundleResult,
  ensureSectionsArray,
  parseSourceURL,
} from "@aligntrue/core";
import { parseNaturalMarkdown } from "@aligntrue/core/parsing/natural-markdown";
import { parseYamlToJson, type Align, type RuleFile } from "@aligntrue/schema";
import type { AlignTrueConfig } from "@aligntrue/core";
import type { GitProgressUpdate } from "./git-progress.js";

export interface ResolvedSource {
  content: string;
  sourcePath: string;
  sourceType: "local" | "git" | "url";
  commitSha?: string | undefined; // For git sources
}

/**
 * Parse source content into Align based on file extension
 * Handles both YAML and markdown with frontmatter
 */
function parseSourceContent(content: string, sourcePath: string): Align {
  const ext = extname(sourcePath).toLowerCase();

  if (ext === ".md" || ext === ".markdown") {
    // Parse markdown with optional YAML frontmatter
    const parsed = parseNaturalMarkdown(content);

    // Convert to Align format
    return {
      id: parsed.metadata.id || "imported-align",
      version: parsed.metadata.version || "1.0.0",
      spec_version: "1",
      sections: parsed.sections,
    };
  } else {
    // Parse as YAML
    return parseYamlToJson(content) as Align;
  }
}

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

  if (!source) {
    throw new Error("Source configuration is required");
  }

  // Build source URL string from config
  let sourceUrl = "";
  if (source.type === "local" && source.path) {
    sourceUrl = source.path;
  } else if (source.type === "git" && source.url) {
    sourceUrl = source.url;
    if (source.ref) {
      sourceUrl += `@${source.ref}`;
    }
    if (source.path) {
      sourceUrl += `/${source.path}`;
    }
  } else if (source.type === "url" && source.url) {
    sourceUrl = source.url;
  }

  // Use core resolver to fetch rules
  const resolved = await coreResolveSource(sourceUrl, {
    cwd,
    offlineMode,
    forceRefresh,
    onProgress: options?.onGitProgress
      ? (msg: string) => {
          // Convert string progress to GitProgressUpdate for compatibility
          options.onGitProgress?.({
            phase: "metadata",
            message: msg,
            repo: sourceUrl,
          });
        }
      : undefined,
  });

  // Convert rules to Align format for merging
  const sections = resolved.rules.map((rule: RuleFile) => ({
    heading: rule.frontmatter.title || rule.filename.replace(/\.md$/, ""),
    content: rule.content,
    level: 2, // Schema requires level 2-6 (## through ######)
    fingerprint: rule.hash,
    source_file: rule.path,
    frontmatter: rule.frontmatter,
  }));

  // Return synthesized YAML content for backward compatibility with merge logic
  const align: Align = {
    id: source.type === "local" ? "local-rules" : "imported-align",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  // Stringify to YAML for content field (backward compat)
  const { stringify } = await import("yaml");
  const content = stringify(align);

  return {
    content,
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
            type: "git" | "local" | "url";
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

  // If only one source, no merging needed
  if (resolved.length === 1) {
    const firstSource = resolved[0];
    if (!firstSource) {
      throw new Error("First resolved source is undefined");
    }
    const align = parseSourceContent(
      firstSource.content,
      firstSource.sourcePath,
    );
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
      sources: resolved,
    };
  }

  // Parse all sources into Aligns
  const aligns: Align[] = [];
  for (const source of resolved) {
    try {
      const align = parseSourceContent(source.content, source.sourcePath);
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
    } catch (error) {
      throw new Error(
        `Failed to parse source as Align\n` +
          `  Source: ${source.sourcePath}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    sources: resolved,
  };
}
