import matter from "gray-matter";
import yaml from "js-yaml";
import type { AlignKind } from "./types";

export type ExtractedMetadata = {
  title: string | null;
  description: string | null;
  fileType: "markdown" | "yaml" | "unknown";
  kind: AlignKind;
};

function safeFrontmatterTitle(md: string): string | null {
  const { data, content } = matter(md);
  if (typeof data?.title === "string") return data.title;
  if (typeof data?.description === "string") return data.description;

  const lines = content.split("\n");
  const heading = lines.find((line) => line.trim().startsWith("#"));
  if (heading) {
    return heading.replace(/^#+\s*/, "").trim() || null;
  }
  return null;
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

  if (isYaml) {
    const { title, description } = safeYamlTitle(content);
    return {
      title,
      description,
      fileType: "yaml",
      kind: "rule_group",
    };
  }

  const title = safeFrontmatterTitle(content);
  return {
    title,
    description: null,
    fileType: "markdown",
    kind: "rule",
  };
}
