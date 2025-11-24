import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { computeHash } from "@aligntrue/schema";

export interface AgentExportHashes {
  version: "1";
  exports: Record<string, string>; // path -> SHA-256 hash
  updated_at: number; // For human debugging only
}

/**
 * Get stored agent export hashes
 * @param cwd - Workspace root directory
 */
export function getAgentExportHashes(cwd: string): AgentExportHashes | null {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  if (!existsSync(hashFile)) {
    return null;
  }

  try {
    const content = readFileSync(hashFile, "utf-8");
    return JSON.parse(content) as AgentExportHashes;
  } catch {
    return null;
  }
}

/**
 * Store an agent export hash
 * @param cwd - Workspace root directory
 * @param agentPath - Relative path to agent file (e.g., "AGENTS.md")
 * @param content - Content to hash
 */
export function storeAgentExportHash(
  cwd: string,
  agentPath: string,
  content: string,
): void {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  // Load existing hashes or create new
  const existing = getAgentExportHashes(cwd);
  const hashes: AgentExportHashes = existing || {
    version: "1",
    exports: {},
    updated_at: Date.now(),
  };

  // Compute SHA-256 hash
  const hash = computeHash(content);

  // Update hash for this file
  hashes.exports[agentPath] = hash;
  hashes.updated_at = Date.now();

  // Save back to file
  try {
    const dir = dirname(hashFile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hashFile, JSON.stringify(hashes, null, 2), "utf-8");
  } catch (err) {
    console.warn(`Failed to save agent export hashes: ${err}`);
  }
}

/**
 * Get stored hash for a specific agent file
 * @param cwd - Workspace root directory
 * @param agentPath - Relative path to agent file
 */
export function getStoredHash(cwd: string, agentPath: string): string | null {
  const hashes = getAgentExportHashes(cwd);
  return hashes?.exports[agentPath] || null;
}
