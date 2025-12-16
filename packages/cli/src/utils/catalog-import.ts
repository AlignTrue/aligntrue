import { mkdirSync } from "fs";
import { dirname, join, relative, basename } from "path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import {
  computeContentHash,
  type RuleFile,
  type RuleFrontmatter,
} from "@aligntrue/schema";
import {
  fetchAlignRecord,
  fetchPackRuleRecords,
  type CatalogRecord,
} from "./catalog-client.js";

const FETCH_TIMEOUT_MS = 30_000;

type ImportWarning = { id: string; reason: string };

export interface CatalogImportResult {
  kind: "pack" | "rule";
  title: string;
  rules: RuleFile[];
  warnings: ImportWarning[];
}

export async function importFromCatalog(
  catalogId: string,
  targetDir: string,
  cwd: string,
): Promise<CatalogImportResult> {
  const initial = await fetchAlignRecord(catalogId);

  if (initial.kind === "pack") {
    const { pack, rules } = await fetchPackRuleRecords(catalogId);
    return buildPackImport(pack, rules, targetDir, cwd);
  }

  const ruleFile = await buildRuleFile(initial, targetDir, cwd);
  return {
    kind: "rule",
    title: initial.title ?? initial.id,
    rules: ruleFile?.rule ? [ruleFile.rule] : [],
    warnings: ruleFile?.warning ? [ruleFile.warning] : [],
  };
}

async function buildPackImport(
  pack: CatalogRecord,
  rules: CatalogRecord[],
  targetDir: string,
  cwd: string,
): Promise<CatalogImportResult> {
  const collected: RuleFile[] = [];
  const warnings: ImportWarning[] = [];

  for (const rule of rules) {
    const result = await buildRuleFile(rule, targetDir, cwd);
    if (result?.rule) {
      collected.push(result.rule);
    }
    if (result?.warning) {
      warnings.push(result.warning);
    }
  }

  return {
    kind: "pack",
    title: pack.title ?? pack.id,
    rules: collected,
    warnings,
  };
}

async function buildRuleFile(
  record: CatalogRecord,
  targetDir: string,
  cwd: string,
): Promise<{ rule?: RuleFile; warning?: ImportWarning }> {
  if (record.sourceRemoved) {
    return { warning: { id: record.id, reason: "source removed" } };
  }

  const rawUrl = toRawUrl(record.normalizedUrl);
  if (!rawUrl) {
    return { warning: { id: record.id, reason: "missing normalizedUrl" } };
  }

  let content: string;
  try {
    content = await fetchTextWithTimeout(rawUrl);
  } catch (error) {
    return {
      warning: {
        id: record.id,
        reason:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "failed to fetch content",
      },
    };
  }

  let parsed = safeMatter(content);
  if (parsed.content.trimStart().startsWith("---")) {
    const stripped = stripFrontmatter(parsed.content);
    parsed = {
      ...parsed,
      data: { ...(parsed.data as object), ...stripped.data },
      content: stripped.body,
    } as matter.GrayMatterFile<string>;
  }

  const filename =
    filenameFromUrl(record.normalizedUrl ?? record.id) || `${record.id}.md`;

  const rawRelativePath =
    extractPathFromNormalizedUrl(record.normalizedUrl) ?? filename;
  const normalizedRelativePath = normalizeImportPath(rawRelativePath);
  const relativePath =
    normalizedRelativePath ||
    normalizeImportPath(filename) ||
    `${record.id}.md`;
  const normalizedFilename = basename(relativePath);

  const fullPath = join(targetDir, relativePath);

  mkdirSync(dirname(fullPath), { recursive: true });

  const frontmatter: RuleFrontmatter = {
    ...(parsed.data as RuleFrontmatter),
  };
  if (!frontmatter.title && record.title) {
    frontmatter.title = record.title;
  }

  const rule: RuleFile = {
    content: parsed.content,
    frontmatter,
    path: relative(cwd, fullPath),
    filename: normalizedFilename,
    relativePath,
    hash: computeContentHash({ content: parsed.content, frontmatter }),
  };

  return { rule };
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url} (${res.status})`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function safeMatter(content: string): matter.GrayMatterFile<string> {
  try {
    return matter(content);
  } catch {
    if (content.trimStart().startsWith("---")) {
      const stripped = stripFrontmatter(content);
      return {
        data: stripped.data,
        content: stripped.body,
        excerpt: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
        toString: () => stripped.body,
      } as matter.GrayMatterFile<string>;
    }
    return {
      data: {},
      content,
      excerpt: "",
      orig: "",
      language: "",
      matter: "",
      stringify: () => "",
      toString: () => content,
    } as matter.GrayMatterFile<string>;
  }
}

function stripFrontmatter(content: string): { data: object; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { data: {}, body: content };
  }

  const frontmatterRaw = match[1] ?? "";
  let data: object = {};
  try {
    data = (parseYaml(frontmatterRaw) as object) || {};
  } catch {
    data = {};
  }

  const body = content.slice(match[0].length);
  return { data, body };
}

function filenameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const last = pathname.split("/").filter(Boolean).pop();
    return last ?? null;
  } catch {
    const segments = url.split("/").filter(Boolean);
    return segments.pop() ?? null;
  }
}

function normalizeImportPath(urlPath: string): string {
  if (!urlPath) return urlPath;

  // Remove leading "./" to normalize relative paths
  let normalized = urlPath.replace(/^\.?\//, "");

  // Strip common agent-specific prefixes that should not live under .aligntrue/rules/
  const prefixes = [
    ".cursor/rules/",
    ".cursor/",
    ".vscode/",
    ".augment/rules/",
    ".amazonq/rules/",
    ".kilocode/rules/",
    ".trae/rules/",
    ".goose/rules/",
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }

  // Convert Cursor-exported .mdc files back to canonical .md
  if (normalized.endsWith(".mdc")) {
    normalized = normalized.slice(0, -4) + ".md";
  }

  return normalized;
}

function extractPathFromNormalizedUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const blobIndex = parts.findIndex((p) => p === "blob");
    if (blobIndex !== -1 && parts.length > blobIndex + 2) {
      const pathParts = parts.slice(blobIndex + 2);
      if (pathParts.length > 0) {
        return pathParts.join("/");
      }
    }
    // raw URLs: after host/owner/repo/branch/...
    if (parsed.hostname === "raw.githubusercontent.com" && parts.length > 3) {
      const pathParts = parts.slice(3);
      return pathParts.join("/");
    }
    return null;
  } catch {
    return null;
  }
}

function toRawUrl(blobUrl?: string | null): string | null {
  if (!blobUrl) return null;
  try {
    const url = new URL(blobUrl);
    if (
      url.hostname === "gist.githubusercontent.com" ||
      url.hostname === "raw.githubusercontent.com"
    ) {
      return blobUrl;
    }
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, maybeBlob, branch, ...rest] = parts;
    if (owner && repo && maybeBlob === "blob" && branch && rest.length > 0) {
      const path = rest.join("/");
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }
    return null;
  } catch {
    return null;
  }
}
