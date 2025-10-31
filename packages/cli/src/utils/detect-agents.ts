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
const AGENT_PATTERNS: Record<string, string[]> = {
  // Phase 1 exporters
  cursor: [".cursor/", ".cursor/rules/"],
  "agents-md": ["AGENTS.md"],
  "vscode-mcp": [".vscode/", ".vscode/mcp.json"],

  // MCP config exporters
  "cursor-mcp": [".cursor/", ".cursor/mcp.json"],
  "root-mcp": [".mcp.json"],
  "windsurf-mcp": [".windsurf/", ".windsurf/mcp_config.json"],
  "amazonq-mcp": [".amazonq/", ".amazonq/mcp.json"],
  "firebase-mcp": [".idx/", ".idx/mcp.json"],
  "kilocode-mcp": [".kilocode/", ".kilocode/mcp.json"],
  "roocode-mcp": [".roo/", ".roo/mcp.json"],

  // Markdown format exporters
  "claude-md": ["CLAUDE.md"],
  "crush-md": ["CRUSH.md"],
  "warp-md": ["WARP.md"],
  copilot: ["AGENTS.md"], // Shares AGENTS.md format
  jules: ["AGENTS.md"],
  amp: ["AGENTS.md"],
  "openai-codex": ["AGENTS.md"],
  "windsurf-md": ["AGENTS.md"],
  "aider-md": ["AGENTS.md"],
  "gemini-cli": ["AGENTS.md"],
  "qwen-code": ["AGENTS.md"],
  "roocode-md": ["AGENTS.md"],
  "zed-md": ["AGENTS.md"],
  "opencode-md": ["AGENTS.md"],

  // Plain text format exporters
  cline: [".clinerules"],
  goose: [".goosehints"],

  // JSON/Config format exporters
  firebender: ["firebender.json"],
  "crush-config": [".crush.json"],
  "opencode-config": ["opencode.json"],
  "gemini-config": [".gemini/", ".gemini/settings.json"],
  "qwen-config": [".qwen/", ".qwen/settings.json"],
  "zed-config": [".zed/", ".zed/settings.json"],
  "codex-config": [".codex/", ".codex/config.toml"],
  "openhands-config": ["config.toml"],

  // Directory-based exporters
  amazonq: [".amazonq/", ".amazonq/rules/"],
  augmentcode: [".augment/", ".augment/rules/"],
  kilocode: [".kilocode/", ".kilocode/rules/"],
  kiro: [".kiro/", ".kiro/steering/"],
  "firebase-studio": [".idx/", ".idx/airules.md"],
  junie: [".junie/", ".junie/guidelines.md"],
  "trae-ai": [".trae/", ".trae/rules/project_rules.md"],
  openhands: [".openhands/", ".openhands/microagents/repo.md"],

  // YAML config exporters
  "aider-config": [".aider.conf.yml"],
};

/**
 * Human-readable display names for agents
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
