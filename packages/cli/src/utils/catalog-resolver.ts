import { existsSync } from "fs";

const CATALOG_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const CATALOG_URL_PATTERN =
  /^https?:\/\/aligntrue\.ai\/a\/([a-zA-Z0-9_-]{11})$/;

export function isCatalogId(input: string): boolean {
  const trimmed = input.trim();

  if (CATALOG_URL_PATTERN.test(trimmed)) return true;

  if (CATALOG_ID_PATTERN.test(trimmed)) {
    // If a file/dir exists with this name, treat it as local path, not catalog ID.
    if (existsSync(trimmed)) return false;
    return true;
  }

  return false;
}

export function extractCatalogId(input: string): string | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(CATALOG_URL_PATTERN);
  if (urlMatch) return urlMatch[1];

  if (CATALOG_ID_PATTERN.test(trimmed) && !existsSync(trimmed)) {
    return trimmed;
  }

  return null;
}
