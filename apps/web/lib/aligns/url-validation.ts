import { normalizeGitUrl, type NormalizedGitSource } from "./normalize";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_FILENAMES,
  BULK_IMPORT_MAX_URLS,
} from "./constants";

export type UrlValidationResult = {
  url: string;
  valid: boolean;
  error?: string;
  owner?: string;
  normalized?: NormalizedGitSource;
  filename?: string | null;
};

export function hasAllowedExtension(url: string): boolean {
  const lower = url.toLowerCase();
  const filename = lower.split("/").pop() || "";
  if (
    ALLOWED_FILENAMES.includes(filename as (typeof ALLOWED_FILENAMES)[number])
  )
    return true;
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateAlignUrl(url: string): UrlValidationResult {
  const trimmed = url.trim();
  if (!trimmed) return { url, valid: false, error: "URL is empty" };

  const normalized = normalizeGitUrl(trimmed);
  if (normalized.provider !== "github" || !normalized.normalizedUrl) {
    return { url, valid: false, error: "Unsupported or invalid GitHub URL" };
  }

  if (!hasAllowedExtension(normalized.normalizedUrl)) {
    return {
      url,
      valid: false,
      error:
        "Unsupported file type. Use .md, .yaml, .xml, or allowed agent files",
      normalized,
    };
  }

  return {
    url,
    valid: true,
    owner: normalized.owner,
    normalized,
    filename: normalized.filename ?? normalized.path?.split("/").pop() ?? null,
  };
}

export function validateAlignUrls(urls: string[]): {
  results: UrlValidationResult[];
  allValid: boolean;
  uniqueOwners: string[];
  limited: boolean;
} {
  const limited = urls.length > BULK_IMPORT_MAX_URLS;
  const slice = limited ? urls.slice(0, BULK_IMPORT_MAX_URLS) : urls;

  const seen = new Set<string>();
  const results = slice.map((url) => {
    const res = validateAlignUrl(url);
    if (res.valid) {
      if (seen.has(res.normalized?.normalizedUrl ?? res.url)) {
        return { ...res, valid: false, error: "Duplicate URL detected" };
      }
      seen.add(res.normalized?.normalizedUrl ?? res.url);
    }
    return res;
  });

  const allValid = results.every((r) => r.valid);
  const owners = results
    .filter((r) => r.valid && r.owner)
    .map((r) => r.owner as string);
  const uniqueOwners = Array.from(new Set(owners));

  return { results, allValid, uniqueOwners, limited };
}
