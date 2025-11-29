/**
 * Rule importer - fetches and converts rules from external sources
 *
 * Supports:
 * - Git repositories (GitHub, GitLab, etc.)
 * - HTTP/HTTPS URLs
 * - Local file paths (absolute or relative)
 *
 * Converts all rules to .md format with proper frontmatter
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join, basename, extname, isAbsolute, resolve } from "path";
import matter from "gray-matter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { glob } from "glob";
import type { RuleFile } from "../rules/file-io.js";
import type { RuleFrontmatter } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { parseSourceUrl, type SourceType } from "./source-detector.js";
import { detectConflicts, type ConflictInfo } from "./conflict-resolver.js";

// Configure gray-matter to use yaml library
const matterOptions = {
  engines: {
    yaml: {
      parse: (str: string) => parseYaml(str) as object,
      stringify: (obj: object) => stringifyYaml(obj),
    },
  },
};

/**
 * Options for importing rules
 */
export interface ImportOptions {
  /** Source URL, path, or git URL */
  source: string;
  /** Git ref (branch/tag/commit) - only for git sources */
  ref?: string | undefined;
  /** Current working directory */
  cwd: string;
  /** Target directory for imported rules (e.g., .aligntrue/rules) */
  targetDir: string;
  /** Cache directory for git/url sources */
  cacheDir?: string | undefined;
}

/**
 * Result of importing rules
 */
export interface ImportResult {
  /** Successfully parsed rules */
  rules: RuleFile[];
  /** Conflicts with existing rules */
  conflicts: ConflictInfo[];
  /** Source URL/path */
  source: string;
  /** Detected source type */
  sourceType: SourceType;
  /** Error message if import failed */
  error?: string;
}

/**
 * Import rules from a source
 *
 * @param options - Import options
 * @returns Import result with rules and any conflicts
 */
export async function importRules(
  options: ImportOptions,
): Promise<ImportResult> {
  const { source, cwd, targetDir } = options;
  const parsed = parseSourceUrl(source);

  try {
    let rules: RuleFile[];

    switch (parsed.type) {
      case "local":
        rules = await importFromLocal(parsed.url, cwd, source);
        break;

      case "git":
        rules = await importFromGit(options, parsed);
        break;

      case "url":
        rules = await importFromUrl(parsed.url, source);
        break;

      default:
        throw new Error(`Unknown source type: ${parsed.type}`);
    }

    // Add source metadata to all rules
    const now = new Date().toISOString().split("T")[0] ?? ""; // YYYY-MM-DD
    for (const rule of rules) {
      rule.frontmatter["source"] = source;
      rule.frontmatter["source_added"] = now;
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
      sourceType: parsed.type,
    };
  } catch (error) {
    return {
      rules: [],
      conflicts: [],
      source,
      sourceType: parsed.type,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Import rules from a local path
 */
async function importFromLocal(
  localPath: string,
  cwd: string,
  originalSource: string,
): Promise<RuleFile[]> {
  // Resolve path relative to cwd
  const fullPath = isAbsolute(localPath) ? localPath : resolve(cwd, localPath);

  if (!existsSync(fullPath)) {
    throw new Error(`Path not found: ${fullPath}`);
  }

  const stat = statSync(fullPath);

  if (stat.isFile()) {
    // Single file import
    const rule = parseRuleFromFile(fullPath, cwd, originalSource);
    return rule ? [rule] : [];
  }

  if (stat.isDirectory()) {
    // Directory import - find all markdown files
    return await importFromDirectory(fullPath, cwd, originalSource);
  }

  throw new Error(`Invalid path: ${fullPath}`);
}

/**
 * Import all markdown files from a directory
 */
async function importFromDirectory(
  dirPath: string,
  cwd: string,
  originalSource: string,
): Promise<RuleFile[]> {
  // Find all .md and .mdc files
  const patterns = ["**/*.md", "**/*.mdc"];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: dirPath,
      absolute: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });
    files.push(...matches);
  }

  const rules: RuleFile[] = [];

  for (const file of files) {
    const rule = parseRuleFromFile(file, cwd, originalSource);
    if (rule) {
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * Parse a single rule file
 */
function parseRuleFromFile(
  filePath: string,
  cwd: string,
  originalSource: string,
): RuleFile | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const ext = extname(filePath).toLowerCase();

    // Parse based on file type
    if (ext === ".mdc") {
      return parseMdcFile(content, filePath, cwd, originalSource);
    }

    // Default: parse as markdown with optional frontmatter
    return parseMdFile(content, filePath, cwd, originalSource);
  } catch (error) {
    console.warn(
      `Warning: Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Parse a .md file with optional YAML frontmatter
 */
function parseMdFile(
  content: string,
  filePath: string,
  cwd: string,
  originalSource: string,
): RuleFile {
  const parsed = matter(content, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;

  // Extract title from frontmatter or first heading
  let title = frontmatter.title;
  if (!title) {
    const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
    title = headingMatch
      ? headingMatch[1]
      : basename(filePath, extname(filePath));
  }
  // Ensure title is defined
  const finalTitle = title || "untitled-rule";

  // Generate filename from title
  const filename = generateFilename(finalTitle);

  // Compute hash
  const hash = computeContentHash(content);

  return {
    content: parsed.content,
    frontmatter: {
      ...frontmatter,
      title: finalTitle,
      source: originalSource,
    },
    path: filename,
    filename,
    hash,
  };
}

/**
 * Parse a .mdc (Cursor) file
 * MDC files have YAML frontmatter between --- markers
 */
function parseMdcFile(
  content: string,
  filePath: string,
  cwd: string,
  originalSource: string,
): RuleFile {
  // MDC files use the same frontmatter format as MD
  const parsed = matter(content, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;

  // Extract title from frontmatter or first heading
  let title = frontmatter.title;
  if (!title) {
    const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
    title = headingMatch ? headingMatch[1] : basename(filePath, ".mdc");
  }
  // Ensure title is defined
  const finalTitle = title || "untitled-rule";

  // Generate .md filename (convert from .mdc)
  const filename = generateFilename(finalTitle);

  // Compute hash
  const hash = computeContentHash(content);

  // Convert Cursor-specific frontmatter to AlignTrue format
  const convertedFrontmatter: RuleFrontmatter = {
    ...frontmatter,
    title: finalTitle,
    source: originalSource,
  };

  // Map Cursor 'when' to 'apply_to' if present
  if (frontmatter.cursor?.when) {
    convertedFrontmatter.apply_to = frontmatter.cursor.when;
  }

  return {
    content: parsed.content,
    frontmatter: convertedFrontmatter,
    path: filename,
    filename,
    hash,
  };
}

/**
 * Import rules from a git repository
 *
 * This uses dynamic import for @aligntrue/sources to avoid circular dependency issues.
 * The sources package is an optional peer dependency.
 */
async function importFromGit(
  options: ImportOptions,
  parsed: ReturnType<typeof parseSourceUrl>,
): Promise<RuleFile[]> {
  const { cwd, ref } = options;
  const cacheDir = options.cacheDir || join(cwd, ".aligntrue", ".cache", "git");

  // Dynamic import to avoid circular dependency at compile time
  // The sources package is an optional peer dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GitProvider: any;
  try {
    // Use Function to avoid TypeScript resolving the module at compile time
    const importDynamic = new Function("specifier", "return import(specifier)");
    const sourcesModule = await importDynamic("@aligntrue/sources");
    GitProvider = sourcesModule.GitProvider;
  } catch {
    throw new Error(
      "Git import requires @aligntrue/sources package. Install it with: pnpm add @aligntrue/sources",
    );
  }

  const gitRef = ref || parsed.ref || "main";
  const gitPath = parsed.path || "";

  const provider = new GitProvider(
    {
      type: "git",
      url: parsed.url,
      ref: gitRef,
      path: gitPath || ".",
    },
    cacheDir,
    {
      mode: "solo",
      force: true, // Force refresh for import
    },
  );

  // Fetch the repository
  await provider.fetch(gitRef);

  // Get the cached repo directory
  const { computeHash } = await import("@aligntrue/schema");
  const repoHash = computeHash(parsed.url).substring(0, 16);
  const repoDir = join(cacheDir, repoHash);

  if (!existsSync(repoDir)) {
    throw new Error(`Failed to clone repository: ${parsed.url}`);
  }

  // Determine what to import
  const importPath = gitPath ? join(repoDir, gitPath) : repoDir;

  if (!existsSync(importPath)) {
    throw new Error(`Path not found in repository: ${gitPath || "/"}`);
  }

  const stat = statSync(importPath);

  if (stat.isFile()) {
    const rule = parseRuleFromFile(importPath, cwd, options.source);
    return rule ? [rule] : [];
  }

  // Import from directory
  return await importFromDirectory(importPath, cwd, options.source);
}

/**
 * Import rules from an HTTP URL
 */
async function importFromUrl(
  url: string,
  originalSource: string,
): Promise<RuleFile[]> {
  // Fetch the content
  const response = await fetch(url, {
    headers: { "User-Agent": "AlignTrue/1.0" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch URL: ${response.status} ${response.statusText}`,
    );
  }

  const content = await response.text();

  // Determine file type from URL
  const urlPath = new URL(url).pathname;
  const ext = extname(urlPath).toLowerCase();

  // Parse as markdown
  const parsed = matter(content, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;

  // Extract title
  let title = frontmatter.title;
  if (!title) {
    const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
    title = headingMatch
      ? headingMatch[1]
      : basename(urlPath, ext) || "imported-rule";
  }
  // Ensure title is defined
  const finalTitle = title || "imported-rule";

  const filename = generateFilename(finalTitle);
  const hash = computeContentHash(content);

  return [
    {
      content: parsed.content,
      frontmatter: {
        ...frontmatter,
        title: finalTitle,
        source: originalSource,
      },
      path: filename,
      filename,
      hash,
    },
  ];
}

/**
 * Generate a safe filename from a title
 */
function generateFilename(title: string): string {
  const safeName =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled-rule";

  return `${safeName}.md`;
}
