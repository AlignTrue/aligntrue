import matter from "gray-matter";
import yaml from "js-yaml";

export const SUPPORTED_AGENT_IDS = [
  "aligntrue",
  "all",
  "cursor",
  "claude",
  "windsurf",
  "copilot",
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

export type ConvertedContent = {
  text: string;
  filename: string;
  extension: string;
};

export function isAgentId(value: string): value is AgentId {
  return (SUPPORTED_AGENT_IDS as readonly string[]).includes(value);
}

type Frontmatter = Record<string, unknown>;

function parseFrontmatter(content: string): {
  data: Frontmatter;
  body: string;
} {
  try {
    const parsed = matter(content, {
      engines: { yaml: (s: string) => yaml.load(s) as Record<string, unknown> },
    });
    return { data: parsed.data ?? {}, body: parsed.content };
  } catch {
    // On malformed frontmatter, return raw content with empty data
    return { data: {}, body: content };
  }
}

function stringifyFrontmatter(data: Frontmatter): string {
  const yamlContent = yaml.dump(data ?? {});
  return `---\n${yamlContent}---`;
}

function withFrontmatter(data: Frontmatter, body: string): string {
  if (!data || Object.keys(data).length === 0) {
    return body.trimStart();
  }
  const fm = stringifyFrontmatter(data);
  return `${fm}\n\n${body.trimStart()}`;
}

function minimalFrontmatter(data: Frontmatter): Frontmatter {
  const out: Frontmatter = {};
  if (typeof data.title === "string") out.title = data.title;
  if (typeof data.description === "string") out.description = data.description;
  return out;
}

function cursorFrontmatter(data: Frontmatter): Frontmatter {
  const result: Frontmatter = {};
  // map cursor-specific metadata if provided
  if (data.cursor && typeof data.cursor === "object") {
    Object.assign(result, data.cursor as Record<string, unknown>);
  }
  // fallback to common fields if not present
  if (!result.description) {
    if (typeof data.description === "string")
      result.description = data.description;
    else if (typeof data.title === "string") result.description = data.title;
    else result.description = "AlignTrue rules for Cursor";
  }
  // Preserve globs; ensure key exists even when undefined for consistent shape
  if (data.globs !== undefined) {
    result.globs = data.globs;
  } else if (!("globs" in result)) {
    result.globs = undefined;
  }
  // Always allow; consumers can refine later
  if (result.alwaysApply === undefined) {
    if (data.apply_to === "alwaysOn") {
      result.alwaysApply = true;
    } else if (data.apply_to === "agent_requested") {
      result.alwaysApply = false;
    } else {
      result.alwaysApply = true;
    }
  }
  return result;
}

export function convertContent(
  rawContent: string,
  targetAgent: AgentId,
): ConvertedContent {
  const { data, body } = parseFrontmatter(rawContent);

  switch (targetAgent) {
    case "aligntrue": {
      return {
        text: rawContent,
        filename: "rules.md",
        extension: "md",
      };
    }
    case "all": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "AGENTS.md",
        extension: "md",
      };
    }
    case "cursor": {
      const fm = cursorFrontmatter(data);
      const text = withFrontmatter(fm, body);
      return {
        text,
        filename: "rules.mdc",
        extension: "mdc",
      };
    }
    case "gemini": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "GEMINI.md",
        extension: "md",
      };
    }
    case "zed": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "ZED.md",
        extension: "md",
      };
    }
    case "warp": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "WARP.md",
        extension: "md",
      };
    }
    case "cline": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "augmentcode": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "amazonq": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "openhands": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "antigravity": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "kiro": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "rules.md",
        extension: "md",
      };
    }
    case "claude": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "CLAUDE.md",
        extension: "md",
      };
    }
    case "windsurf": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "WINDSURF.md",
        extension: "md",
      };
    }
    case "copilot": {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "AGENTS.md",
        extension: "md",
      };
    }
    default: {
      const fm = minimalFrontmatter(data);
      return {
        text: withFrontmatter(fm, body),
        filename: "AGENTS.md",
        extension: "md",
      };
    }
  }
}
