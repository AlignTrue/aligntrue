import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Link Checker for AlignTrue Documentation and CLI messages
 *
 * Validates:
 * - /docs/... links in docs content
 * - https://aligntrue.ai/... links in docs + CLI source files
 * - Short links that map to redirects defined in apps/docs/vercel.json
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_ROOT = path.join(__dirname, "../content");
const REDIRECTS_PATH = path.join(__dirname, "../vercel.json");

const MARKDOWN_LINK_PATTERN =
  /\[([^\]]+)\]\(((?:https?:\/\/aligntrue\.ai\/[^\s)]+)|(?:\/docs\/[^\s)]+))\)/g;
const ABSOLUTE_LINK_PATTERN = /https?:\/\/aligntrue\.ai\/[^\s)"']+/g;
const RELATIVE_DOCS_PATTERN = /\/docs\/[^\s)"']+/g;

export interface BrokenLink {
  file: string;
  linkText: string;
  linkPath: string;
  line: number;
  expectedFile: string;
}

type LinkMatch = {
  target: string;
  index: number;
  text: string;
};

function getAllFiles(
  dir: string,
  exts: RegExp,
  accumulator: string[] = [],
): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, exts, accumulator);
    } else if (entry.isFile() && exts.test(entry.name)) {
      accumulator.push(fullPath);
    }
  }

  return accumulator;
}

function getDocsFiles(): string[] {
  return getAllFiles(DOCS_ROOT, /\.(md|mdx)$/);
}

function getCliFiles(): string[] {
  const cliRoot = path.join(__dirname, "../../packages/cli/src");
  if (!fs.existsSync(cliRoot)) {
    return [];
  }
  return getAllFiles(cliRoot, /\.(ts|tsx)$/);
}

function loadRedirectSources(): Set<string> {
  try {
    const raw = fs.readFileSync(REDIRECTS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      redirects?: { source: string; destination: string }[];
    };
    const set = new Set<string>();
    parsed.redirects?.forEach((r) => set.add(r.source));
    return set;
  } catch {
    return new Set<string>();
  }
}

/**
 * Convert a /docs/ link path to the actual file path
 */
function linkToFilePath(linkPath: string): string {
  // Handle index pages
  if (!linkPath || linkPath === "") {
    return path.join(DOCS_ROOT, "index.mdx");
  }

  // Split the path into segments
  const segments = linkPath.split("/").filter((s) => s);

  if (segments.length === 0) {
    return path.join(DOCS_ROOT, "index.mdx");
  }

  // First segment might be a section number (e.g., "00-getting-started")
  const firstSegment = segments[0];

  // Try to build the path
  let filePath: string;

  if (firstSegment === "about") {
    filePath = path.join(DOCS_ROOT, "about.md");
  } else {
    // Construct directory path from segments
    const joinedPath = segments.join(path.sep);

    // Try with .md first, then .mdx
    filePath = path.join(DOCS_ROOT, joinedPath + ".md");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath + ".mdx");
    }
    // Also try as an index file in a directory
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath, "index.md");
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath, "index.mdx");
    }
  }

  return filePath;
}

function linkExists(linkPath: string): boolean {
  const filePath = linkToFilePath(linkPath);
  return fs.existsSync(filePath);
}

function normalizeLink(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && url.host === "aligntrue.ai") {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // If invalid URL, fall through to return as-is
  }
  return raw;
}

function stripHash(pathname: string): string {
  const hashIndex = pathname.indexOf("#");
  return hashIndex === -1 ? pathname : pathname.slice(0, hashIndex);
}

function stripCodeBlocksAndInline(content: string): string {
  const lines = content.split("\n");
  let inFence = false;

  const cleaned = lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = !inFence;
        return "";
      }
      if (inFence) return "";
      return line.replace(/`[^`]*`/g, "");
    })
    .join("\n");

  return cleaned;
}

function extractLinks(content: string, isMarkdown: boolean): LinkMatch[] {
  const body = isMarkdown ? stripCodeBlocksAndInline(content) : content;
  const results: LinkMatch[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  while ((match = MARKDOWN_LINK_PATTERN.exec(body)) !== null) {
    const target = match[2];
    const key = `${match.index}:${target}`;
    if (!seen.has(key)) {
      results.push({
        target,
        index: match.index,
        text: match[1],
      });
      seen.add(key);
    }
  }

  ABSOLUTE_LINK_PATTERN.lastIndex = 0;
  while ((match = ABSOLUTE_LINK_PATTERN.exec(body)) !== null) {
    const target = match[0];
    const key = `${match.index}:${target}`;
    if (!seen.has(key)) {
      results.push({
        target,
        index: match.index,
        text: target,
      });
      seen.add(key);
    }
  }

  RELATIVE_DOCS_PATTERN.lastIndex = 0;
  while ((match = RELATIVE_DOCS_PATTERN.exec(body)) !== null) {
    const target = match[0];
    const key = `${match.index}:${target}`;
    if (!seen.has(key)) {
      results.push({
        target,
        index: match.index,
        text: target,
      });
      seen.add(key);
    }
  }

  return results;
}

function checkLinksInFile(
  filePath: string,
  redirectSources: Set<string>,
  rootForRelative: string,
): BrokenLink[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const relativePath = path.relative(rootForRelative, filePath);
  const errors: BrokenLink[] = [];

  const isMarkdown = filePath.endsWith(".md") || filePath.endsWith(".mdx");
  const links = extractLinks(content, isMarkdown);

  for (const link of links) {
    const normalized = stripHash(normalizeLink(link.target));

    // Only validate aligntrue links and /docs links
    if (
      !normalized.startsWith("/docs/") &&
      !normalized.startsWith("/") // covers short redirects like /team
    ) {
      continue;
    }

    if (normalized.startsWith("/docs/")) {
      const docPath = normalized.replace(/^\/docs\//, "");
      if (!linkExists(docPath)) {
        errors.push({
          file: relativePath,
          linkText: link.text,
          linkPath: normalized,
          line: content.substring(0, link.index).split("\n").length,
          expectedFile: linkToFilePath(docPath),
        });
      }
    } else {
      // Non-/docs path must be a redirect
      if (!redirectSources.has(normalized)) {
        errors.push({
          file: relativePath,
          linkText: link.text,
          linkPath: normalized,
          line: content.substring(0, link.index).split("\n").length,
          expectedFile: "Redirect entry in apps/docs/vercel.json",
        });
      }
    }
  }

  return errors;
}

export function checkAllLinks(): BrokenLink[] {
  const redirectSources = loadRedirectSources();
  const docsFiles = getDocsFiles();
  const cliFiles = getCliFiles();
  const allErrors: BrokenLink[] = [];

  for (const file of docsFiles) {
    allErrors.push(...checkLinksInFile(file, redirectSources, DOCS_ROOT));
  }

  for (const file of cliFiles) {
    allErrors.push(
      ...checkLinksInFile(
        file,
        redirectSources,
        path.join(__dirname, "../../packages/cli"),
      ),
    );
  }

  return allErrors;
}

export function getLinkStats(): { totalFiles: number; totalLinks: number } {
  const docsFiles = getDocsFiles();
  const cliFiles = getCliFiles();
  const allFiles = [...docsFiles, ...cliFiles];

  let totalLinks = 0;
  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const isMarkdown = file.endsWith(".md") || file.endsWith(".mdx");
    totalLinks += extractLinks(content, isMarkdown).length;
  }

  return {
    totalFiles: allFiles.length,
    totalLinks,
  };
}
