import { readFileSync, writeFileSync, existsSync } from "fs";
import { relative, basename } from "path";
import matter from "gray-matter";
import yaml from "js-yaml";
import { glob } from "glob";
import type { RuleFrontmatter, RuleFile } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";

// Re-export RuleFile from schema
export type { RuleFile } from "@aligntrue/schema";

// Configure gray-matter to use js-yaml 4.x API (which doesn't have safeLoad)
const matterOptions = {
  engines: {
    yaml: {
      parse: (str: string) => yaml.load(str) as object,
      stringify: (obj: object) => yaml.dump(obj),
    },
  },
};

/**
 * Parse a rule file from disk
 * @param filePath Absolute path to file
 * @param cwd Workspace root (for relative path calculation)
 */
export function parseRuleFile(filePath: string, cwd: string): RuleFile {
  if (!existsSync(filePath)) {
    throw new Error(`Rule file not found: ${filePath}`);
  }

  const rawContent = readFileSync(filePath, "utf-8");
  const parsed = matter(rawContent, matterOptions);
  const frontmatter = parsed.data as RuleFrontmatter;
  const relativePath = relative(cwd, filePath);
  const filename = basename(relativePath);

  // Ensure content hash matches actual content
  const computedHash = computeContentHash(rawContent);
  if (frontmatter.content_hash && frontmatter.content_hash !== computedHash) {
    // Drift detected - but we just load it as is.
    // Validation/Fix logic happens elsewhere.
  }

  return {
    content: parsed.content,
    frontmatter: {
      ...frontmatter,
      // Ensure title exists (fallback to filename)
      title: frontmatter.title || filename.replace(/\.md$/, ""),
    },
    path: relativePath,
    filename,
    hash: computedHash,
  };
}

/**
 * Write a rule file to disk
 * @param filePath Absolute path to write to
 * @param rule Rule object
 */
export function writeRuleFile(filePath: string, rule: RuleFile): void {
  // Build frontmatter YAML using js-yaml directly (gray-matter uses deprecated API)
  const updatedFrontmatter = {
    ...rule.frontmatter,
  };

  // Build content string with frontmatter
  const frontmatterYaml = yaml.dump(updatedFrontmatter, {
    sortKeys: true,
    noRefs: true,
  });
  const contentWithFrontmatter = `---\n${frontmatterYaml}---\n${rule.content}`;

  // Update content hash
  const hash = computeContentHash(contentWithFrontmatter);
  updatedFrontmatter.content_hash = hash;

  // Rebuild with updated hash
  const finalFrontmatterYaml = yaml.dump(updatedFrontmatter, {
    sortKeys: true,
    noRefs: true,
  });
  const finalContent = `---\n${finalFrontmatterYaml}---\n${rule.content}`;

  writeFileSync(filePath, finalContent, "utf-8");
}

/**
 * Load all rules from a directory (recursively)
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

  const pattern = options.recursive ? "**/*.md" : "*.md";
  const files = await glob(pattern, { cwd: dir, absolute: true });

  return files.map((file) => parseRuleFile(file, cwd));
}
