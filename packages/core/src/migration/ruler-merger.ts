/**
 * Ruler content merger
 * Merges multiple markdown files from .ruler/ directory
 */

import { readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";

/**
 * Merge all markdown files from .ruler/ directory
 * Follows Ruler's concatenation order (alphabetical)
 *
 * @param rulerDir - Path to .ruler/ directory
 * @returns Merged markdown content
 */
export async function mergeRulerMarkdownFiles(
  rulerDir: string,
): Promise<string> {
  // Find all .md files in .ruler/
  const mdFiles = glob.sync("**/*.md", {
    cwd: rulerDir,
    ignore: ["node_modules/**"],
  });

  // Sort alphabetically (Ruler's concatenation order)
  mdFiles.sort();

  // Read and concatenate
  const sections: string[] = [];
  for (const file of mdFiles) {
    const content = readFileSync(join(rulerDir, file), "utf-8");
    sections.push(`<!-- Source: .ruler/${file} -->\n${content}`);
  }

  return sections.join("\n\n---\n\n");
}
