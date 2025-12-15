import matter from "gray-matter";
import type { AlignKind } from "./types";

export type ExtractedMetadata = {
  title: string | null;
  description: string | null;
  author?: string | null;
  fileType: "markdown" | "xml" | "unknown";
  kind: AlignKind;
};

type SimpleFrontmatter = {
  title: string | null;
  description: string | null;
  author: string | null;
  content: string;
  malformed: boolean;
};

function normalizeValue(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  const quoteMatch = trimmed.match(/^['"](.*)['"]$/);
  if (quoteMatch) return quoteMatch[1] || null;
  return trimmed || null;
}

function parseSimpleFrontmatter(md: string): SimpleFrontmatter {
  const lines = md.split("\n");
  const hasOpeningFence = lines[0]?.trim() === "---";
  if (!hasOpeningFence) {
    return {
      title: null,
      description: null,
      author: null,
      content: md,
      malformed: false,
    };
  }

  const endIdx = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (endIdx === -1) {
    // frontmatter start without closing fence: cannot safely parse, avoid YAML headings
    return {
      title: null,
      description: null,
      author: null,
      content: "",
      malformed: true,
    };
  }

  const frontmatterLines = lines.slice(1, endIdx);
  const content = lines.slice(endIdx + 1).join("\n");

  const pick = (key: "title" | "description" | "author"): string | null => {
    const lowerKey = `${key}:`;
    let startLine: string | null = null;
    let startIndex = -1;

    for (const [i, line] of frontmatterLines.entries()) {
      if (line.trim().toLowerCase().startsWith(lowerKey)) {
        startLine = line;
        startIndex = i;
        break;
      }
    }

    if (!startLine || startIndex === -1) return null;

    const [, firstValue = ""] = startLine.split(/:\s*(.*)/);
    const collected = [firstValue];

    for (const next of frontmatterLines.slice(startIndex + 1)) {
      if (!next) {
        collected.push("");
        continue;
      }
      const isIndented = /^\s+/.test(next);
      if (!isIndented) break;
      collected.push(next.trim());
    }

    const joined = collected.join("\n").trimEnd();
    return normalizeValue(joined || null);
  };

  return {
    title: pick("title"),
    description: pick("description"),
    author: pick("author"),
    content,
    malformed: false,
  };
}

function safeFrontmatterMetadata(md: string): {
  title: string | null;
  description: string | null;
  author: string | null;
} {
  const simple = parseSimpleFrontmatter(md);

  if (simple.malformed) {
    return { title: null, description: null, author: null };
  }

  try {
    const { data, content } = matter(md);
    const headingFromContent = (() => {
      const lines = content.split("\n");
      const heading = lines.find((line) => line.trim().startsWith("#"));
      if (heading) return heading.replace(/^#+\s*/, "").trim() || null;
      return null;
    })();

    const title =
      normalizeValue(typeof data?.title === "string" ? data.title : null) ||
      simple.title ||
      headingFromContent;
    const description =
      normalizeValue(
        typeof data?.description === "string" ? data.description : null,
      ) ||
      simple.description ||
      null;
    const author =
      normalizeValue(typeof data?.author === "string" ? data.author : null) ||
      simple.author ||
      null;

    return { title: title ?? null, description, author };
  } catch {
    const heading = (() => {
      const lines = simple.content.split("\n");
      const found = lines.find((line) => line.trim().startsWith("#"));
      return found ? found.replace(/^#+\s*/, "").trim() || null : null;
    })();
    return {
      title: simple.title ?? heading,
      description: simple.description,
      author: simple.author,
    };
  }
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
  const isXml = lower.endsWith(".xml");

  if (isXml) {
    return {
      title: humanizeFilename(normalizedUrl),
      description: null,
      author: null,
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
