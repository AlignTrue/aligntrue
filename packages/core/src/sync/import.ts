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

    case "copilot":
    case "claude-code":
    case "aider":
    case "agents-md":
      return await importFromAgentsMd(workspaceRoot);

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
 * Check if agent supports import
 */
export function canImportFromAgent(agentName: string): boolean {
  const supported = ["cursor", "copilot", "claude-code", "aider", "agents-md"];
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
    case "copilot":
    case "claude-code":
    case "aider":
    case "agents-md":
      return join(workspaceRoot, "AGENTS.md");
    default:
      return "";
  }
}
