/**
 * Agent detection utility
 * Detects installed AI coding agents by checking for their output files/directories
 */

import { existsSync } from "fs";
import { join } from "path";

/**
 * Detection patterns for all 28 agents
 * Maps agent name to detection patterns (files/directories to check)
 */
export const AGENT_PATTERNS: Record<string, string[]> = {
  // Phase 1 exporters
  cursor: [".cursor/rules/"], // Only detect if rules subdirectory exists
  "agents-md": ["AGENTS.md"],
  "vscode-mcp": [".vscode/mcp.json"], // Only detect if MCP config exists

  // MCP config exporters
  "cursor-mcp": [".cursor/mcp.json"], // Only detect if MCP config exists
  "root-mcp": [".mcp.json"],
  "windsurf-mcp": [".windsurf/mcp_config.json"], // Only detect if MCP config exists
  "amazonq-mcp": [".amazonq/mcp.json"], // Only detect if MCP config exists
  "firebase-mcp": [".idx/mcp.json"], // Only detect if MCP config exists
  "kilocode-mcp": [".kilocode/mcp.json"], // Only detect if MCP config exists
  "roocode-mcp": [".roo/mcp.json"], // Only detect if MCP config exists

  // Markdown format exporters
  "claude-md": ["CLAUDE.md"],
  "crush-md": ["CRUSH.md"],
  "warp-md": ["WARP.md"],
  "gemini-md": ["GEMINI.md"],
  // Note: agents that share AGENTS.md are intentionally not auto-detected
  // Users must explicitly enable them if needed

  // Plain text format exporters
  cline: [".clinerules"],
  goose: [".goosehints"],

  // JSON/Config format exporters
  firebender: ["firebender.json"],
  "crush-config": [".crush.json"],
  "opencode-config": ["opencode.json"],
  "gemini-config": [".gemini/settings.json"], // Only detect if config exists
  "qwen-config": [".qwen/settings.json"], // Only detect if config exists
  "zed-config": [".zed/settings.json"], // Only detect if config exists
  "codex-config": [".codex/config.toml"], // Only detect if config exists
  "openhands-config": ["config.toml"],

  // Directory-based exporters
  amazonq: [".amazonq/rules/"], // Only detect if rules subdirectory exists
  augmentcode: [".augment/rules/"], // Only detect if rules subdirectory exists
  kilocode: [".kilocode/rules/"], // Only detect if rules subdirectory exists
  kiro: [".kiro/steering/"], // Only detect if steering subdirectory exists
  "firebase-studio": [".idx/airules.md"], // Only detect if specific file exists
  junie: [".junie/guidelines.md"], // Only detect if specific file exists
  "trae-ai": [".trae/rules/project_rules.md"], // Only detect if specific file exists
  openhands: [".openhands/microagents/repo.md"], // Only detect if specific file exists

  // YAML config exporters
  "aider-config": [".aider.conf.yml"],
};

/**
 * Human-readable display names for agents (includes all agents, not just auto-detected)
 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  cursor: "Cursor",
  "agents-md": "Universal AGENTS.md",
  "vscode-mcp": "VS Code MCP",
  "cursor-mcp": "Cursor MCP",
  "root-mcp": "Root MCP (Claude Code, Aider)",
  "windsurf-mcp": "Windsurf MCP",
  "amazonq-mcp": "Amazon Q MCP",
  "firebase-mcp": "Firebase Studio MCP",
  "kilocode-mcp": "Kilocode MCP",
  "roocode-mcp": "Roo Code MCP",
  "claude-md": "Claude (CLAUDE.md)",
  "crush-md": "Crush (CRUSH.md)",
  "warp-md": "Warp (WARP.md)",
  "gemini-md": "Gemini (GEMINI.md)",
  copilot: "GitHub Copilot",
  jules: "Jules",
  amp: "Amp",
  "openai-codex": "OpenAI Codex",
  "windsurf-md": "Windsurf",
  "aider-md": "Aider",
  "gemini-cli": "Gemini CLI",
  "qwen-code": "Qwen Code",
  "roocode-md": "Roo Code",
  "zed-md": "Zed",
  "opencode-md": "Open Code",
  cline: "Cline",
  goose: "Goose",
  firebender: "Firebender",
  "crush-config": "Crush Config",
  "opencode-config": "Open Code Config",
  "gemini-config": "Gemini Config",
  "qwen-config": "Qwen Config",
  "zed-config": "Zed Config",
  "codex-config": "Codex Config",
  "openhands-config": "OpenHands Config",
  amazonq: "Amazon Q",
  augmentcode: "Augment Code",
  kilocode: "Kilocode",
  kiro: "Kiro",
  "firebase-studio": "Firebase Studio",
  junie: "Junie",
  "trae-ai": "Trae AI",
  openhands: "OpenHands",
  "aider-config": "Aider Config",
};

/**
 * Result of agent detection
 */
export interface DetectionResult {
  /** List of detected agent names */
  detected: string[];
  /** Recommended agents to enable (same as detected) */
  recommended: string[];
  /** Display names for detected agents */
  displayNames: Map<string, string>;
}

/**
 * Detect agents in the given directory
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns Detection result with detected and recommended agents
 */
export function detectAgents(cwd: string = process.cwd()): DetectionResult {
  const detected: string[] = [];
  const displayNames = new Map<string, string>();

  for (const [agentName, patterns] of Object.entries(AGENT_PATTERNS)) {
    // Check if any of the patterns exist
    const found = patterns.some((pattern) => {
      const fullPath = join(cwd, pattern);
      return existsSync(fullPath);
    });

    if (found) {
      detected.push(agentName);
      displayNames.set(agentName, AGENT_DISPLAY_NAMES[agentName] || agentName);
    }
  }

  return {
    detected,
    recommended: detected, // For now, recommend all detected
    displayNames,
  };
}

/**
 * Get display name for an agent
 */
export function getAgentDisplayName(agentName: string): string {
  return AGENT_DISPLAY_NAMES[agentName] || agentName;
}

/**
 * Get all available agent names
 */
export function getAllAgents(): string[] {
  return Object.keys(AGENT_PATTERNS);
}

/**
 * Detect agents not in config and not ignored
 * @param cwd - Directory to check
 * @param currentExporters - Currently enabled exporters
 * @param ignoredAgents - Agents user has chosen to ignore
 * @returns New agents with file paths
 */
export function detectNewAgents(
  cwd: string,
  currentExporters: string[],
  ignoredAgents: string[],
): Array<{ name: string; displayName: string; filePath: string }> {
  const allDetected = detectAgents(cwd);
  const currentSet = new Set(currentExporters);
  const ignoredSet = new Set(ignoredAgents);

  const newAgents: Array<{
    name: string;
    displayName: string;
    filePath: string;
  }> = [];

  for (const agentName of allDetected.detected) {
    if (!currentSet.has(agentName) && !ignoredSet.has(agentName)) {
      // Get first matching file path for display
      const patterns = AGENT_PATTERNS[agentName] || [];
      const foundPath =
        patterns.find((p) => existsSync(join(cwd, p))) || patterns[0];

      newAgents.push({
        name: agentName,
        displayName: allDetected.displayNames.get(agentName) || agentName,
        filePath: foundPath || "",
      });
    }
  }

  return newAgents;
}
