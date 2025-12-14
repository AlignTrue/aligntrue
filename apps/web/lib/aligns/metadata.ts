import matter from "gray-matter";
import yaml from "js-yaml";
import type { AlignKind } from "./types";

export type ExtractedMetadata = {
  title: string | null;
  description: string | null;
  author?: string | null;
  fileType: "markdown" | "yaml" | "xml" | "unknown";
  kind: AlignKind;
};

function safeFrontmatterMetadata(md: string): {
  title: string | null;
  description: string | null;
  author: string | null;
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

    const author = typeof data?.author === "string" ? data.author : null;

    return { title: title ?? null, description, author };
  } catch {
    // On malformed frontmatter, fall back to first heading in raw markdown
    const lines = md.split("\n");
    const hasOpeningFence = lines[0]?.trim() === "---";
    if (hasOpeningFence) {
      const endIdx = lines.findIndex(
        (line, i) => i > 0 && line.trim() === "---",
      );
      if (endIdx === -1) {
        // frontmatter start without closing fence: cannot safely parse, avoid YAML headings
        return { title: null, description: null, author: null };
      }
      const frontmatterLines = lines.slice(1, endIdx);
      const descriptionLine = frontmatterLines.find((line) =>
        line.trim().toLowerCase().startsWith("description:"),
      );
      const description = descriptionLine
        ? descriptionLine.split(/description\s*:\s*/i)[1]?.trim() || null
        : null;
      const authorLine = frontmatterLines.find((line) =>
        line.trim().toLowerCase().startsWith("author:"),
      );
      const author = authorLine
        ? authorLine.split(/author\s*:\s*/i)[1]?.trim() || null
        : null;
      const heading = lines
        .slice(endIdx + 1)
        .find((line) => line.trim().startsWith("#"));
      const title = heading
        ? heading.replace(/^#+\s*/, "").trim() || null
        : null;
      return { title, description, author };
    }
    const heading = lines.find((line) => line.trim().startsWith("#"));
    const title = heading ? heading.replace(/^#+\s*/, "").trim() || null : null;
    return { title, description: null, author: null };
  }
}

function safeYamlTitle(text: string): {
  title: string | null;
  description: string | null;
  author: string | null;
} {
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title : null;
      const description =
        typeof obj.description === "string" ? obj.description : null;
      const author = typeof obj.author === "string" ? obj.author : null;
      return { title, description, author };
    }
  } catch {
    // best effort
  }
  return { title: null, description: null, author: null };
}

function humanizeFilename(url: string): string {
  const fallback = "Align";

  const extractFilename = (value: string): string => {
    try {
      const parsed = new URL(value);
      const parts = parsed.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    } catch {
      const parts = value.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    }
  };

  const raw = extractFilename(url);
  if (!raw) return fallback;

  const withoutLeadingDots = raw.replace(/^\.+/, "");
  const withoutExtension = withoutLeadingDots.replace(/\.[^.]+$/, "");
  const withSpaces = withoutExtension.replace(/[-_.]+/g, " ").trim();
  if (!withSpaces) return fallback;

  const lower = withSpaces.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function extractMetadata(
  normalizedUrl: string,
  content: string,
): ExtractedMetadata {
  const lower = normalizedUrl.toLowerCase();
  const isYaml = lower.endsWith(".yaml") || lower.endsWith(".yml");
  const isXml = lower.endsWith(".xml");

  if (isYaml) {
    const { title, description, author } = safeYamlTitle(content);
    return {
      title: title ?? humanizeFilename(normalizedUrl),
      description,
      author,
      fileType: "yaml",
      kind: "pack",
    };
  }

  if (isXml) {
    return {
      title: humanizeFilename(normalizedUrl),
      description: null,
      fileType: "xml",
      kind: "rule",
    };
  }

  const { title, description, author } = safeFrontmatterMetadata(content);
  return {
    title: title ?? humanizeFilename(normalizedUrl),
    description,
    author,
    fileType: "markdown",
    kind: "rule",
  };
}
