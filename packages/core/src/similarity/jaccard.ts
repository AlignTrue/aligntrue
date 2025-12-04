/**
 * Jaccard similarity for detecting content overlap between rule files
 *
 * Used during init to identify when multiple agent files (Cursor, AGENTS.md, CLAUDE.md)
 * contain mostly the same content, allowing us to import only the preferred format
 * and backup the rest.
 */

/**
 * Normalize content into a set of tokens for comparison
 *
 * - Converts to lowercase
 * - Removes markdown formatting (headers, code blocks, etc.)
 * - Splits on whitespace and punctuation
 * - Filters out very short tokens (< 3 chars) to reduce noise
 *
 * @param content - Raw content string
 * @returns Set of normalized tokens
 */
export function normalizeTokens(content: string): Set<string> {
  // Remove YAML frontmatter if present
  let text = content.replace(/^---[\s\S]*?---\n?/, "");

  // Remove code blocks (keep just a marker to preserve some semantics)
  text = text.replace(/```[\s\S]*?```/g, " codeblock ");

  // Remove inline code
  text = text.replace(/`[^`]+`/g, " ");

  // Remove markdown headers markers but keep the text
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove markdown links but keep text: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove markdown emphasis markers
  text = text.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");

  // Convert to lowercase
  text = text.toLowerCase();

  // Split on whitespace and punctuation, keeping only word characters
  const tokens = text.split(/[\s\-_.,;:!?()[\]{}<>"'`\/\\|@#$%^&*+=~]+/);

  // Filter out short tokens and empty strings
  const filtered = tokens.filter((t) => t.length >= 3);

  return new Set(filtered);
}

/**
 * Calculate Jaccard similarity between two token sets
 *
 * Jaccard index = |A ∩ B| / |A ∪ B|
 * Returns a value between 0 (no overlap) and 1 (identical)
 *
 * @param a - First token set
 * @param b - Second token set
 * @returns Similarity score between 0 and 1
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1; // Both empty = identical
  }

  if (a.size === 0 || b.size === 0) {
    return 0; // One empty = no similarity
  }

  // Calculate intersection
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection++;
    }
  }

  // Calculate union: |A| + |B| - |A ∩ B|
  const union = a.size + b.size - intersection;

  return intersection / union;
}

/**
 * File with content for similarity comparison
 */
export interface FileWithContent {
  /** Relative path to the file */
  path: string;
  /** File content */
  content: string;
  /** Agent type (cursor, agents, claude, etc.) */
  type: string;
}

/**
 * A group of similar files
 */
export interface SimilarityGroup {
  /** The canonical file (preferred source) */
  canonical: FileWithContent;
  /** Similar files that should be backed up */
  duplicates: Array<{
    file: FileWithContent;
    /** Similarity score to canonical (0-1) */
    similarity: number;
  }>;
}

/**
 * Result of similarity analysis
 */
export interface SimilarityResult {
  /** Groups of similar files */
  groups: SimilarityGroup[];
  /** Files with no significant overlap */
  unique: FileWithContent[];
}

/**
 * Agent format priority for canonical source selection
 * Lower number = higher priority
 *
 * Exported for use in init command recommendation logic.
 */
export const FORMAT_PRIORITY: Record<string, number> = {
  // Multi-file formats (preferred)
  cursor: 1,
  amazonq: 2,
  augmentcode: 3,
  kilocode: 4,
  kiro: 5,
  "firebase-studio": 6,
  "trae-ai": 7,

  // Single-file formats
  agents: 10,
  claude: 11,
  crush: 12,
  warp: 13,
  windsurf: 14,
  zed: 15,
  gemini: 16,

  // Plain text formats
  cline: 20,
  goose: 21,
  cursorrules: 22,
};

/**
 * Get priority for a file type (lower = preferred)
 */
export function getFormatPriority(type: string): number {
  return FORMAT_PRIORITY[type] ?? 100;
}

/**
 * Get the best (highest priority) format from a list of types
 *
 * Used by init command to recommend the most structured format
 * when multiple agent file types are detected.
 *
 * @param types - Array of agent types (e.g., ["cursor", "agents", "claude"])
 * @param fallback - Fallback value if types array is empty (default: "multi-file")
 * @returns The type with the lowest priority number (most preferred)
 */
export function getBestFormat(
  types: string[],
  fallback: string = "multi-file",
): string {
  if (types.length === 0) {
    return fallback;
  }

  return types.reduce((best, current) => {
    const currentPriority = getFormatPriority(current);
    const bestPriority = getFormatPriority(best);
    return currentPriority < bestPriority ? current : best;
  }, types[0]!);
}

/**
 * Select the canonical file from a group of similar files
 *
 * Priority:
 * 1. Multi-file format (Cursor preferred)
 * 2. Content completeness (more tokens = more complete)
 */
function selectCanonical(
  files: FileWithContent[],
  tokenSets: Map<string, Set<string>>,
): FileWithContent {
  // Use slice() to avoid mutating the input array
  return files.slice().sort((a, b) => {
    // First by format priority
    const priorityDiff = getFormatPriority(a.type) - getFormatPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;

    // Then by content completeness (more tokens = more complete)
    const aTokens = tokenSets.get(a.path)?.size ?? 0;
    const bTokens = tokenSets.get(b.path)?.size ?? 0;
    return bTokens - aTokens; // More tokens first
  })[0]!;
}

/**
 * Find groups of similar content across multiple files
 *
 * Uses Union-Find to group files that are similar to each other,
 * then selects the canonical source for each group.
 *
 * @param files - Files to compare
 * @param threshold - Similarity threshold (0-1), default 0.75
 * @returns Groups of similar files and unique files
 */
export function findSimilarContent(
  files: FileWithContent[],
  threshold = 0.75,
): SimilarityResult {
  if (files.length <= 1) {
    return {
      groups: [],
      unique: files,
    };
  }

  // Compute token sets for all files
  const tokenSets = new Map<string, Set<string>>();
  for (const file of files) {
    tokenSets.set(file.path, normalizeTokens(file.content));
  }

  // Compute pairwise similarities and build adjacency
  const similarities = new Map<string, Map<string, number>>();
  const adjacency = new Map<string, Set<string>>();

  for (const file of files) {
    adjacency.set(file.path, new Set());
    similarities.set(file.path, new Map());
  }

  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const fileA = files[i]!;
      const fileB = files[j]!;
      const tokensA = tokenSets.get(fileA.path)!;
      const tokensB = tokenSets.get(fileB.path)!;

      const sim = jaccardSimilarity(tokensA, tokensB);

      if (sim >= threshold) {
        adjacency.get(fileA.path)!.add(fileB.path);
        adjacency.get(fileB.path)!.add(fileA.path);
        similarities.get(fileA.path)!.set(fileB.path, sim);
        similarities.get(fileB.path)!.set(fileA.path, sim);
      }
    }
  }

  // Find connected components using BFS
  const visited = new Set<string>();
  const components: FileWithContent[][] = [];

  for (const file of files) {
    if (visited.has(file.path)) continue;

    const component: FileWithContent[] = [];
    const queue = [file.path];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      const currentFile = files.find((f) => f.path === current)!;
      component.push(currentFile);

      for (const neighbor of adjacency.get(current)!) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  // Build result
  const groups: SimilarityGroup[] = [];
  const unique: FileWithContent[] = [];

  for (const component of components) {
    if (component.length === 1) {
      unique.push(component[0]!);
    } else {
      const canonical = selectCanonical(component, tokenSets);
      const duplicates = component
        .filter((f) => f.path !== canonical.path)
        .map((file) => ({
          file,
          similarity: similarities.get(canonical.path)!.get(file.path) ?? 0,
        }));

      groups.push({ canonical, duplicates });
    }
  }

  return { groups, unique };
}

/**
 * Default similarity threshold for detecting duplicates
 * 75% overlap is a good balance between catching copy-paste
 * and avoiding false positives
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
