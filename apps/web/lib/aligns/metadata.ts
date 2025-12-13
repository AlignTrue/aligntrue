import matter from "gray-matter";
import yaml from "js-yaml";
import type { AlignKind } from "./types";

export type ExtractedMetadata = {
  title: string | null;
  description: string | null;
  fileType: "markdown" | "yaml" | "xml" | "unknown";
  kind: AlignKind;
};

function safeFrontmatterMetadata(md: string): {
  title: string | null;
  description: string | null;
} {
  try {
    // gray-matter defaults to js-yaml safeLoad (removed in js-yaml@4); provide a custom engine
    const { data, content } = matter(md, {
      engines: {
        yaml: (s: string) => yaml.load(s) as Record<string, unknown>,
      },
    });
    const title =
      (typeof data?.title === "string" && data.title) ||
      (() => {
        const lines = content.split("\n");
        const heading = lines.find((line) => line.trim().startsWith("#"));
        if (heading) return heading.replace(/^#+\s*/, "").trim() || null;
        return null;
      })();

    const description =
      typeof data?.description === "string" ? data.description : null;

    return { title: title ?? null, description };
  } catch {
    // On malformed frontmatter, fall back to first heading in raw markdown
    const lines = md.split("\n");
    const heading = lines.find((line) => line.trim().startsWith("#"));
    const title = heading ? heading.replace(/^#+\s*/, "").trim() || null : null;
    return { title, description: null };
  }
}

function safeYamlTitle(text: string): {
  title: string | null;
  description: string | null;
} {
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title : null;
      const description =
        typeof obj.description === "string" ? obj.description : null;
      return { title, description };
    }
  } catch {
    // best effort
  }
  return { title: null, description: null };
}

export function extractMetadata(
  normalizedUrl: string,
  content: string,
): ExtractedMetadata {
  const lower = normalizedUrl.toLowerCase();
  const isYaml = lower.endsWith(".yaml") || lower.endsWith(".yml");
  const isXml = lower.endsWith(".xml");

  if (isYaml) {
    const { title, description } = safeYamlTitle(content);
    return {
      title,
      description,
      fileType: "yaml",
      kind: "rule_group",
    };
  }

  if (isXml) {
    const filename = normalizedUrl.split("/").pop() || null;
    return {
      title: filename,
      description: null,
      fileType: "xml",
      kind: "rule",
    };
  }

  const { title, description } = safeFrontmatterMetadata(content);
  return {
    title,
    description,
    fileType: "markdown",
    kind: "rule",
  };
}
