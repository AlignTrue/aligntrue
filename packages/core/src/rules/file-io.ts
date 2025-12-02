import { readFileSync, writeFileSync, existsSync } from "fs";
import { relative, basename, join } from "path";
import matter from "gray-matter";
import { parse, stringify } from "yaml";
import { glob } from "glob";
import type { RuleFrontmatter, RuleFile } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";

// Re-export RuleFile from schema
export type { RuleFile } from "@aligntrue/schema";

/**
 * Common acronyms that should be uppercase in titles
 */
const UPPERCASE_ACRONYMS = new Set([
  "ai",
  "api",
  "app",
  "cd",
  "ci",
  "cli",
  "cpu",
  "css",
  "db",
  "gpu",
  "html",
  "http",
  "https",
  "ip",
  "id",
  "ir",
  "js",
  "jsx",
  "json",
  "llm",
  "mcp",
  "md",
  "mdc",
  "mdx",
  "ml",
  "nlp",
  "npm",
  "os",
  "pr",
  "qa",
  "sdk",
  "sql",
  "ssh",
  "tdd",
  "ts",
  "tsx",
  "ui",
  "url",
  "ux",
  "yaml",
]);

/**
 * Format a filename into a human-readable title
 *
 * Converts snake_case and kebab-case to Title Case,
 * with special handling for common acronyms.
 *
 * @example
 * formatTitleFromFilename("ci_troubleshooting.md") // "CI Troubleshooting"
 * formatTitleFromFilename("cli_testing_playbook.md") // "CLI Testing Playbook"
 * formatTitleFromFilename("typescript.md") // "Typescript"
 */
export function formatTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/, "");
  return base
    .split(/[-_]+/)
    .map((word) =>
      UPPERCASE_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

// Configure gray-matter to use yaml library
const matterOptions = {
  engines: {
    yaml: {
      parse: (str: string) => parse(str) as object,
      stringify: (obj: object) => stringify(obj),
    },
  },
};

/**
 * Parse a rule file from disk
 * @param filePath Absolute path to file
 * @param cwd Workspace root (for relative path calculation)
 */
export function parseRuleFile(
  filePath: string,
  cwd: string,
  rulesDir?: string,
): RuleFile {
  if (!existsSync(filePath)) {
    throw new Error(`Rule file not found: ${filePath}`);
  }

  const rawContent = readFileSync(filePath, "utf-8");
  const parsed = matter(rawContent, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;
  const relativePath = relative(cwd, filePath);
  const filename = basename(relativePath);

  // Compute relative path within rules directory (preserves nested structure)
  let relativePathInRules: string | undefined;
  if (rulesDir) {
    const absoluteRulesDir = rulesDir.startsWith("/")
      ? rulesDir
      : join(cwd, rulesDir);
    if (filePath.startsWith(absoluteRulesDir)) {
      relativePathInRules = relative(absoluteRulesDir, filePath);
    }
  }

  // Ensure content hash matches actual content
  const computedHash = computeContentHash(rawContent);
  if (frontmatter.content_hash && frontmatter.content_hash !== computedHash) {
    // Drift detected - but we just load it as is.
    // Validation/Fix logic happens elsewhere.
  }

  const result: RuleFile = {
    content: parsed.content,
    frontmatter: {
      ...frontmatter,
      // Ensure title exists (fallback to formatted filename)
      title: frontmatter.title || formatTitleFromFilename(filename),
    },
    path: relativePath,
    filename,
    hash: computedHash,
  };

  // Only add relativePath if it was computed (preserves optional property semantics)
  if (relativePathInRules) {
    result.relativePath = relativePathInRules;
  }

  return result;
}

/**
 * Write a rule file to disk
 * @param filePath Absolute path to write to
 * @param rule Rule object
 */
export function writeRuleFile(filePath: string, rule: RuleFile): void {
  // Build frontmatter YAML using yaml library
  const updatedFrontmatter = {
    ...rule.frontmatter,
  };

  // Build content string with frontmatter
  const frontmatterYaml = stringify(updatedFrontmatter);
  const contentWithFrontmatter = `---\n${frontmatterYaml}---\n${rule.content}`;

  // Update content hash
  const hash = computeContentHash(contentWithFrontmatter);
  updatedFrontmatter.content_hash = hash;

  // Rebuild with updated hash
  const finalFrontmatterYaml = stringify(updatedFrontmatter);
  const finalContent = `---\n${finalFrontmatterYaml}---\n${rule.content}`;

  writeFileSync(filePath, finalContent, "utf-8");
}

/**
 * Load all rules from a directory (recursively)
 * Finds both .md and .mdc files, converts .mdc to .md format
 * @param dir Absolute path to directory
 * @param cwd Workspace root
 * @param options Options
 */
export async function loadRulesDirectory(
  dir: string,
  cwd: string,
  options: { recursive: boolean } = { recursive: true },
): Promise<RuleFile[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const patterns = options.recursive
    ? ["**/*.md", "**/*.mdc"]
    : ["*.md", "*.mdc"];
  const files: string[] = [];

  for (const pattern of patterns) {
    // dot: true enables matching files in directories starting with a dot (e.g., .cursor/)
    const matches = await glob(pattern, {
      cwd: dir,
      absolute: true,
      dot: true,
    });
    files.push(...matches);
  }

  // Remove duplicates (in case a file matches multiple patterns)
  const uniqueFiles = Array.from(new Set(files));

  return uniqueFiles.map((file) => {
    const rule = parseRuleFile(file, cwd, dir);
    // Convert .mdc filename to .md if needed
    if (file.endsWith(".mdc")) {
      const mdFilename = rule.filename.endsWith(".mdc")
        ? rule.filename.slice(0, -4) + ".md"
        : rule.filename;
      rule.filename = mdFilename;
      // Also update path if it has .mdc extension
      if (rule.path.endsWith(".mdc")) {
        rule.path = rule.path.slice(0, -4) + ".md";
      }
      if (rule.relativePath && rule.relativePath.endsWith(".mdc")) {
        rule.relativePath = rule.relativePath.slice(0, -4) + ".md";
      }
    }
    return rule;
  });
}

/**
 * Detect non-.md files in a rules directory
 * Returns list of relative paths to non-.md files
 * @param dir Absolute path to directory
 */
export async function detectNonMdFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }

  // Find all files that are not .md
  const allFiles = await glob("**/*", {
    cwd: dir,
    nodir: true,
    ignore: ["**/*.md", "**/.*", "**/node_modules/**"],
  });

  // Filter to only include files with extensions (not hidden files, etc.)
  return allFiles.filter((file) => {
    const ext = file.split(".").pop();
    return ext && ext !== file; // Has an extension
  });
}
