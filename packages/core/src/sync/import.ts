/**
 * Agent→IR import functionality
 * Pulls changes from agent-specific formats back to IR
 */

import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";
import type { AlignRule } from "@aligntrue/schema";
import { parseCursorMdcFiles, parseAgentsMd } from "@aligntrue/markdown-parser";

/**
 * Import rules from agent-specific format
 */
export async function importFromAgent(
  agentName: string,
  workspaceRoot: string = process.cwd(),
): Promise<AlignRule[]> {
  switch (agentName.toLowerCase()) {
    case "cursor":
      return await importFromCursor(workspaceRoot);

    case "cursorrules":
      return await importFromCursorrules(workspaceRoot);

    case "copilot":
    case "claude-code":
    case "aider":
    case "agents-md":
      return await importFromAgentsMd(workspaceRoot);

    // New markdown formats (use AGENTS.md parser with different file names)
    case "claude-md":
      return await importFromMarkdownFile(workspaceRoot, "CLAUDE.md");
    case "crush-md":
      return await importFromMarkdownFile(workspaceRoot, "CRUSH.md");
    case "warp-md":
      return await importFromMarkdownFile(workspaceRoot, "WARP.md");

    default:
      throw new Error(`Import not supported for agent: ${agentName}`);
  }
}

/**
 * Import rules from .cursor/*.mdc files
 */
async function importFromCursor(workspaceRoot: string): Promise<AlignRule[]> {
  const cursorDir = join(workspaceRoot, ".cursor", "rules");

  if (!existsSync(cursorDir)) {
    throw new Error(`.cursor/rules directory not found in ${workspaceRoot}`);
  }

  const files = new Map<string, string>();
  const entries = await readdir(cursorDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && extname(entry.name) === ".mdc") {
      const filePath = join(cursorDir, entry.name);
      const content = await readFile(filePath, "utf-8");
      files.set(filePath, content);
    }
  }

  if (files.size === 0) {
    throw new Error(`No .mdc files found in ${cursorDir}`);
  }

  return parseCursorMdcFiles(files);
}

/**
 * Import rules from legacy .cursorrules file
 */
async function importFromCursorrules(
  workspaceRoot: string,
): Promise<AlignRule[]> {
  const cursorrulesPath = join(workspaceRoot, ".cursorrules");

  if (!existsSync(cursorrulesPath)) {
    throw new Error(`.cursorrules file not found in ${workspaceRoot}`);
  }

  const content = await readFile(cursorrulesPath, "utf-8");

  // .cursorrules uses the same format as .mdc files (YAML frontmatter + markdown)
  // Parse as a single file using the Cursor parser
  const files = new Map<string, string>();
  files.set(cursorrulesPath, content);

  return parseCursorMdcFiles(files);
}

/**
 * Import rules from AGENTS.md
 */
async function importFromAgentsMd(workspaceRoot: string): Promise<AlignRule[]> {
  const agentsMdPath = join(workspaceRoot, "AGENTS.md");

  if (!existsSync(agentsMdPath)) {
    throw new Error(`AGENTS.md not found in ${workspaceRoot}`);
  }

  const content = await readFile(agentsMdPath, "utf-8");
  const { rules } = parseAgentsMd(content);

  if (rules.length === 0) {
    throw new Error(`No rules found in ${agentsMdPath}`);
  }

  return rules;
}

/**
 * Import rules from a markdown file (CLAUDE.md, CRUSH.md, WARP.md, etc.)
 * Uses case-insensitive file detection
 */
async function importFromMarkdownFile(
  workspaceRoot: string,
  baseFileName: string,
): Promise<AlignRule[]> {
  // Try case variations
  const variations = [
    baseFileName, // e.g., CLAUDE.md
    baseFileName.toLowerCase(), // e.g., claude.md
    baseFileName.charAt(0).toUpperCase() + baseFileName.slice(1).toLowerCase(), // e.g., Claude.md
  ];

  let filePath: string | null = null;
  for (const variation of variations) {
    const testPath = join(workspaceRoot, variation);
    if (existsSync(testPath)) {
      filePath = testPath;
      break;
    }
  }

  if (!filePath) {
    throw new Error(
      `${baseFileName} not found in ${workspaceRoot} (tried: ${variations.join(", ")})`,
    );
  }

  const content = await readFile(filePath, "utf-8");
  const { rules } = parseAgentsMd(content);

  if (rules.length === 0) {
    throw new Error(`No rules found in ${filePath}`);
  }

  return rules;
}

/**
 * Check if agent supports import
 */
export function canImportFromAgent(agentName: string): boolean {
  const supported = [
    "cursor",
    "cursorrules",
    "copilot",
    "claude-code",
    "aider",
    "agents-md",
    "claude-md",
    "crush-md",
    "warp-md",
  ];
  return supported.includes(agentName.toLowerCase());
}

/**
 * Get import source path for agent
 */
export function getImportSourcePath(
  agentName: string,
  workspaceRoot: string = process.cwd(),
): string {
  switch (agentName.toLowerCase()) {
    case "cursor":
      return join(workspaceRoot, ".cursor", "rules");
    case "cursorrules":
      return join(workspaceRoot, ".cursorrules");
    case "copilot":
    case "claude-code":
    case "aider":
    case "agents-md":
      return join(workspaceRoot, "AGENTS.md");
    case "claude-md":
      return join(workspaceRoot, "CLAUDE.md");
    case "crush-md":
      return join(workspaceRoot, "CRUSH.md");
    case "warp-md":
      return join(workspaceRoot, "WARP.md");
    default:
      return "";
  }
}
