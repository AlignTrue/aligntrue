/**
 * Agent file discovery for init/import flows
 * Finds existing agent files on disk and classifies whether they can be imported.
 */

import { statSync, readdirSync, Dirent, Stats } from "fs";
import { join, relative } from "path";
import { AGENT_PATTERNS, getAgentDisplayName } from "./detect-agents.js";

/**
 * File format classification for detected agent files
 */
export type AgentFileFormat =
  | "cursor-mdc"
  | "agents"
  | "generic-markdown"
  | "unknown";

export interface AgentFileCandidate {
  agent: string;
  displayName: string;
  absolutePath: string;
  relativePath: string;
  format: AgentFileFormat;
  importable: boolean;
  pathType: "file" | "directory";
}

const GENERIC_MARKDOWN_AGENTS = new Set([
  "agents",
  "claude",
  "crush",
  "warp",
  "gemini",
  "windsurf",
  "aider",
  "opencode",
  "roocode",
  "zed",
  "kilocode",
  "junie",
  "trae-ai",
]);

const CURSOR_AGENT_NAMES = new Set(["cursor"]);

/**
 * Detect agent files present in the workspace.
 */
export function detectAgentFiles(
  cwd: string = process.cwd(),
): AgentFileCandidate[] {
  const candidates: AgentFileCandidate[] = [];
  const seenPaths = new Set<string>();

  for (const [agent, patterns] of Object.entries(AGENT_PATTERNS)) {
    for (const pattern of patterns) {
      const absolutePatternPath = join(cwd, pattern);

      if (pattern.endsWith("/")) {
        const stats = safeStat(absolutePatternPath);
        if (!stats?.isDirectory()) {
          continue;
        }

        const format = classifyFormat(agent);
        if (format === "cursor-mdc") {
          const files = safeReadDir(absolutePatternPath);
          for (const file of files) {
            if (!file.isFile() || !file.name.endsWith(".mdc")) continue;
            const filePath = join(absolutePatternPath, file.name);
            pushCandidate(
              candidates,
              seenPaths,
              agent,
              filePath,
              cwd,
              "file",
              format,
              true,
            );
          }
        } else {
          // Non-importable directory: record directory itself
          pushCandidate(
            candidates,
            seenPaths,
            agent,
            absolutePatternPath,
            cwd,
            "directory",
            format,
            isFormatImportable(format),
          );
        }
      } else {
        const stats = safeStat(absolutePatternPath);
        if (!stats?.isFile()) {
          continue;
        }

        const format = classifyFormat(agent, absolutePatternPath);
        const importable =
          isFormatImportable(format) &&
          (format !== "agents" || absolutePatternPath.endsWith(".md"));

        pushCandidate(
          candidates,
          seenPaths,
          agent,
          absolutePatternPath,
          cwd,
          "file",
          format,
          importable,
        );
      }
    }
  }

  return candidates.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );
}

function pushCandidate(
  list: AgentFileCandidate[],
  seen: Set<string>,
  agent: string,
  absolutePath: string,
  cwd: string,
  pathType: "file" | "directory",
  format: AgentFileFormat,
  importable: boolean,
) {
  const normalized = absolutePath;
  if (seen.has(normalized)) {
    return;
  }
  seen.add(normalized);

  list.push({
    agent,
    displayName: getAgentDisplayName(agent),
    absolutePath,
    relativePath: relative(cwd, absolutePath) || absolutePath,
    format,
    importable: importable && pathType === "file",
    pathType,
  });
}

function classifyFormat(agent: string, filePath?: string): AgentFileFormat {
  if (CURSOR_AGENT_NAMES.has(agent)) {
    return "cursor-mdc";
  }
  if (agent === "agents") {
    return "agents";
  }
  if (GENERIC_MARKDOWN_AGENTS.has(agent) || agent.endsWith("-md")) {
    return "generic-markdown";
  }
  if (filePath?.endsWith(".md")) {
    return "generic-markdown";
  }
  return "unknown";
}

export function isFormatImportable(format: AgentFileFormat): boolean {
  return (
    format === "cursor-mdc" ||
    format === "agents" ||
    format === "generic-markdown"
  );
}

function safeStat(path: string): Stats | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function safeReadDir(path: string): Dirent[] {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}
