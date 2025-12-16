import { SUPPORTED_AGENT_IDS, type AgentId } from "./convert";
import type { TargetFormat } from "./format";

export type AgentOption = {
  id: AgentId;
  name: string;
  path: string;
  label: string;
  format: TargetFormat;
  exporter?: string;
  capabilities: AgentCapabilities;
};

export type AgentCapabilities = {
  cliExport: boolean;
};

const defaultCapabilities: AgentCapabilities = { cliExport: true };

const agentOverrides = new Map<AgentId, Partial<AgentOption>>([
  [
    "original",
    {
      name: "Original",
      path: "(as authored)",
      label: "Original (as authored)",
      format: "original",
      capabilities: { cliExport: false },
    },
  ],
  [
    "aligntrue",
    {
      name: "AlignTrue",
      path: ".aligntrue/rules/*.md",
      label: "AlignTrue (.aligntrue/rules/*.md)",
      format: "align-md",
      exporter: "aligntrue",
      capabilities: { cliExport: false },
    },
  ],
  [
    "all",
    {
      name: "All agents",
      path: "AGENTS.md",
      label: "All agents (AGENTS.md)",
      format: "align-md",
      exporter: "agents",
    },
  ],
  [
    "cursor",
    {
      name: "Cursor",
      path: ".cursor/rules/*.mdc",
      label: "Cursor (.cursor/rules/*.mdc)",
      format: "cursor-mdc",
      exporter: "cursor",
    },
  ],
  [
    "claude",
    {
      name: "Claude Code",
      path: "CLAUDE.md",
      label: "Claude Code (CLAUDE.md)",
      exporter: "claude",
    },
  ],
  [
    "gemini",
    {
      name: "Gemini",
      path: "GEMINI.md",
      label: "Gemini (GEMINI.md)",
      exporter: "gemini",
    },
  ],
  [
    "zed",
    { name: "Zed", path: "ZED.md", label: "Zed (ZED.md)", exporter: "zed" },
  ],
  [
    "warp",
    {
      name: "Warp",
      path: "WARP.md",
      label: "Warp (WARP.md)",
      exporter: "warp",
    },
  ],
  [
    "windsurf",
    {
      name: "Windsurf",
      path: "WINDSURF.md",
      label: "Windsurf (WINDSURF.md)",
      exporter: "windsurf",
    },
  ],
  [
    "copilot",
    {
      name: "GitHub Copilot",
      path: "AGENTS.md",
      label: "GitHub Copilot (AGENTS.md)",
      exporter: "agents",
    },
  ],
  [
    "cline",
    {
      name: "Cline",
      path: ".clinerules/*.md",
      label: "Cline (.clinerules/*.md)",
      exporter: "cline",
    },
  ],
  [
    "augmentcode",
    {
      name: "AugmentCode",
      path: ".augment/rules/*.md",
      label: "AugmentCode (.augment/rules/*.md)",
      exporter: "augmentcode",
    },
  ],
  [
    "amazonq",
    {
      name: "Amazon Q",
      path: ".amazonq/rules/*.md",
      label: "Amazon Q (.amazonq/rules/*.md)",
      exporter: "amazonq",
    },
  ],
  [
    "openhands",
    {
      name: "OpenHands",
      path: ".openhands/*.md",
      label: "OpenHands (.openhands/*.md)",
      exporter: "openhands",
    },
  ],
  [
    "antigravity",
    {
      name: "Antigravity",
      path: ".agent/rules/*.md",
      label: "Antigravity (.agent/rules/*.md)",
      exporter: "antigravity",
    },
  ],
  [
    "kiro",
    {
      name: "Kiro",
      path: ".kiro/steering/*.md",
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
  const name = override.name ?? formatLabel(id);
  const path = override.path ?? "AGENTS.md";
  const label = override.label ?? `${name} (${path})`;
  const format = override.format ?? "align-md";
  const capabilities = { ...defaultCapabilities, ...override.capabilities };
  const exporter =
    capabilities.cliExport === false
      ? override.exporter
      : (override.exporter ?? id);
  return { id, name, path, label, format, exporter, capabilities };
});
