import { existsSync } from "fs";
import { join } from "path";

export function inferAgentTypeFromPath(path: string): string {
  if (path.endsWith("AGENTS.md")) return "agents";
  if (path.endsWith("CLAUDE.md")) return "claude";
  if (path.includes(".cursor/rules") || path.endsWith(".mdc")) return "cursor";
  return "other";
}

export interface FormatOption {
  exporter: string;
  format: string;
  usedBy: string;
  detectPatterns: string[];
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    exporter: "agents",
    format: "AGENTS.md",
    usedBy:
      "GitHub Copilot, OpenAI Codex, Aider, Roo Code, Jules, Amp, Open Code, and more",
    detectPatterns: ["AGENTS.md"],
  },
  {
    exporter: "cursor",
    format: ".cursor/rules/",
    usedBy: "Cursor",
    detectPatterns: [".cursor/rules/", ".cursor/"],
  },
  {
    exporter: "claude",
    format: "CLAUDE.md",
    usedBy: "Claude Code",
    detectPatterns: ["CLAUDE.md"],
  },
  {
    exporter: "windsurf",
    format: ".windsurf/rules/",
    usedBy: "Windsurf",
    detectPatterns: [".windsurf/rules/", ".windsurf/"],
  },
  {
    exporter: "cline",
    format: ".clinerules",
    usedBy: "Cline",
    detectPatterns: [".clinerules"],
  },
  {
    exporter: "zed",
    format: ".zed/rules.md",
    usedBy: "Zed",
    detectPatterns: [".zed/rules.md", ".zed/"],
  },
  {
    exporter: "amazonq",
    format: ".amazonq/rules/",
    usedBy: "Amazon Q",
    detectPatterns: [".amazonq/rules/", ".amazonq/"],
  },
  {
    exporter: "augmentcode",
    format: ".augment/rules/",
    usedBy: "Augment Code",
    detectPatterns: [".augment/rules/", ".augment/"],
  },
  {
    exporter: "crush",
    format: "CRUSH.md",
    usedBy: "Crush",
    detectPatterns: ["CRUSH.md"],
  },
  {
    exporter: "firebender",
    format: "firebender.json",
    usedBy: "Firebender",
    detectPatterns: ["firebender.json"],
  },
  {
    exporter: "firebase-studio",
    format: ".idx/airules.md",
    usedBy: "Firebase Studio",
    detectPatterns: [".idx/airules.md", ".idx/"],
  },
  {
    exporter: "gemini",
    format: "GEMINI.md",
    usedBy: "Google Gemini",
    detectPatterns: ["GEMINI.md"],
  },
  {
    exporter: "goose",
    format: ".goosehints",
    usedBy: "Goose",
    detectPatterns: [".goosehints"],
  },
  {
    exporter: "junie",
    format: ".junie/guidelines.md",
    usedBy: "Junie",
    detectPatterns: [".junie/guidelines.md", ".junie/"],
  },
  {
    exporter: "kilocode",
    format: ".kilocode/rules/",
    usedBy: "Kilo Code",
    detectPatterns: [".kilocode/rules/", ".kilocode/"],
  },
  {
    exporter: "kiro",
    format: ".kiro/steering/",
    usedBy: "Kiro",
    detectPatterns: [".kiro/steering/", ".kiro/"],
  },
  {
    exporter: "openhands",
    format: ".openhands/microagents/repo.md",
    usedBy: "Open Hands",
    detectPatterns: [".openhands/microagents/repo.md", ".openhands/"],
  },
  {
    exporter: "trae-ai",
    format: ".trae/rules/",
    usedBy: "Trae AI",
    detectPatterns: [".trae/rules/", ".trae/"],
  },
  {
    exporter: "warp",
    format: "WARP.md",
    usedBy: "Warp",
    detectPatterns: ["WARP.md"],
  },
];

export const COMMON_EXPORTERS = [
  "agents",
  "cursor",
  "claude",
  "windsurf",
  "cline",
];

export function detectFormats(cwd: string): Set<string> {
  const detected = new Set<string>();
  for (const option of FORMAT_OPTIONS) {
    for (const pattern of option.detectPatterns) {
      if (existsSync(join(cwd, pattern))) {
        detected.add(option.exporter);
        break;
      }
    }
  }
  return detected;
}
