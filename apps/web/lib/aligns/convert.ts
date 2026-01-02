import matter from "gray-matter";
import yaml from "js-yaml";

export const SUPPORTED_AGENT_IDS = [
  "default",
  "cursor",
  "all",
  "claude",
  "windsurf",
  "gemini",
  "zed",
  "warp",
  "cline",
  "augmentcode",
  "amazonq",
  "openhands",
  "antigravity",
  "kiro",
] as const;

export type AgentId = (typeof SUPPORTED_AGENT_IDS)[number];

export function isAgentId(value: string): value is AgentId {
  return (SUPPORTED_AGENT_IDS as readonly string[]).includes(value);
}

export type ParsedFrontmatter = {
  data: Record<string, unknown>;
  body: string;
};

export function parseFrontmatter(content: string): ParsedFrontmatter {
  try {
    const parsed = matter(content, {
      engines: { yaml: (s: string) => yaml.load(s) as Record<string, unknown> },
    });
    return { data: parsed.data ?? {}, body: parsed.content };
  } catch {
    const lines = content.split("\n");
    if (lines[0]?.trim() === "---") {
      const endIdx = lines.findIndex(
        (line, i) => i > 0 && line.trim() === "---",
      );
      if (endIdx !== -1) {
        return { data: {}, body: lines.slice(endIdx + 1).join("\n") };
      }
      return { data: {}, body: "" };
    }
    return { data: {}, body: content };
  }
}
