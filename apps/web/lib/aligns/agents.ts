import { SUPPORTED_AGENT_IDS, type AgentId } from "./convert";
import type { TargetFormat } from "./format";

export type AgentOption = {
  id: AgentId;
  label: string;
  format: TargetFormat;
  exporter: string;
};

const agentOverrides = new Map<AgentId, Partial<AgentOption>>([
  [
    "all",
    {
      label: "All agents (AGENTS.md)",
      format: "align-md",
      exporter: "agents",
    },
  ],
  [
    "cursor",
    {
      label: "Cursor (.cursor/rules/*.mdc)",
      format: "cursor-mdc",
      exporter: "cursor",
    },
  ],
  ["claude", { label: "Claude Code (CLAUDE.md)", exporter: "claude" }],
  ["gemini", { label: "Gemini (GEMINI.md)", exporter: "gemini" }],
  ["zed", { label: "Zed (ZED.md)", exporter: "zed" }],
  ["warp", { label: "Warp (WARP.md)", exporter: "warp" }],
  ["windsurf", { label: "Windsurf (WINDSURF.md)", exporter: "windsurf" }],
  [
    "copilot",
    {
      label: "GitHub Copilot (AGENTS.md)",
      exporter: "agents",
    },
  ],
  [
    "cline",
    {
      label: "Cline (.clinerules/*.md)",
      exporter: "cline",
    },
  ],
  [
    "augmentcode",
    {
      label: "AugmentCode (.augment/rules/*.md)",
      exporter: "augmentcode",
    },
  ],
  [
    "amazonq",
    {
      label: "Amazon Q (.amazonq/rules/*.md)",
      exporter: "amazonq",
    },
  ],
  [
    "openhands",
    {
      label: "OpenHands (.openhands/*.md)",
      exporter: "openhands",
    },
  ],
  [
    "antigravity",
    {
      label: "Antigravity (.agent/rules/*.md)",
      exporter: "antigravity",
    },
  ],
  [
    "kiro",
    {
      label: "Kiro (.kiro/steering/*.md)",
      exporter: "kiro",
    },
  ],
]);

function formatLabel(id: AgentId): string {
  return id.replace(/(^|[_-])(\w)/g, (_match, _sep, chr) => chr.toUpperCase());
}

export const agentOptions: AgentOption[] = SUPPORTED_AGENT_IDS.map((id) => {
  const override = agentOverrides.get(id) ?? {};
  const label = override.label ?? formatLabel(id);
  const format = override.format ?? "align-md";
  const exporter = override.exporter ?? id;
  return { id, label, format, exporter };
});
