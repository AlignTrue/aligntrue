import { join, relative } from "path";
import { glob } from "glob";

/**
 * Represents a detected nested agent file
 */
export interface NestedAgentFile {
  path: string; // Absolute path
  relativePath: string; // Relative to workspace root
  type: "cursor" | "agents" | "claude" | "other";
  directory: string; // Directory containing the file/rules
}

/**
 * Detect all .aligntrue/rules/ directories in the workspace
 * @param cwd Workspace root
 */
export async function detectNestedRuleDirs(cwd: string): Promise<string[]> {
  const matches = await glob("**/.aligntrue/rules/", {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });
  return matches;
}

/**
 * Detect nested agent-specific files (for init/migration)
 * @param cwd Workspace root
 */
export async function detectNestedAgentFiles(
  cwd: string,
): Promise<NestedAgentFile[]> {
  const results: NestedAgentFile[] = [];

  // 1. Cursor rules (.cursor/rules/*.mdc) - detect individual files
  const cursorFiles = await glob("**/.cursor/rules/*.mdc", {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });

  for (const file of cursorFiles) {
    const relPath = relative(cwd, file);
    // Get the directory containing .cursor (parent of .cursor/rules/)
    const cursorRulesDir = file.replace(/[^/]+\.mdc$/, "");
    const directory = join(cursorRulesDir, "../..");
    results.push({
      path: file,
      relativePath: relPath,
      type: "cursor",
      directory,
    });
  }

  // 2. AGENTS.md (in any directory)
  const agentsFiles = await glob("**/AGENTS.md", {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });

  for (const file of agentsFiles) {
    const relPath = relative(cwd, file);
    const dir = file.replace(/AGENTS\.md$/, "");
    results.push({
      path: file,
      relativePath: relPath,
      type: "agents",
      directory: dir,
    });
  }

  // 3. CLAUDE.md
  const claudeFiles = await glob("**/CLAUDE.md", {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });

  for (const file of claudeFiles) {
    const relPath = relative(cwd, file);
    const dir = file.replace(/CLAUDE\.md$/, "");
    results.push({
      path: file,
      relativePath: relPath,
      type: "claude",
      directory: dir,
    });
  }

  return results;
}
