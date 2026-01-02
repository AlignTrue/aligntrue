/**
 * Docs route discovery for sitemap generation
 *
 * Walks content/ directory and converts file paths to public routes.
 * Caches results to reduce filesystem I/O.
 */

import fg from "fast-glob";
import path from "path";

interface Options {
  root?: string;
  prefix?: string; // public path prefix, ex: '/docs'
  ttlMs?: number;
}

// Simple in-memory cache
let cache: { at: number; routes: string[] } | null = null;

/**
 * Normalize file path to public route
 *
 * Examples:
 * - content/index.mdx -> /
 * - content/concepts/catalog/page.md -> /concepts/catalog
 * - content/reference/cli-reference/page.md -> /reference/cli-reference
 *
 * @param file - Relative file path
 * @returns Public route path
 */
function normalizeRoute(file: string): string | null {
  // Strip content/ prefix
  if (!file.startsWith("content/")) return null;

  const rel = file.slice("content/".length);

  // Handle index.mdx at root
  if (rel === "index.mdx" || rel === "index.md") {
    return "/";
  }

  // Remove file extension
  const noExt = rel.replace(/\.(mdx?|md)$/i, "");

  // Remove /page suffix (Nextra convention)
  const withoutPage = noExt.replace(/\/page$/i, "");

  // Split into segments and filter
  const segments = withoutPage
    .split(path.sep)
    .filter((s) => s && !s.startsWith("_")); // Exclude _meta.json and similar

  if (segments.length === 0) return null;

  return "/" + segments.join("/");
}

/**
 * Get all documentation routes by scanning content directory
 *
 * @param opts - Options for route discovery
 * @returns Array of public route paths
 */
export async function getAllDocRoutes(opts: Options = {}): Promise<string[]> {
  const now = Date.now();
  const ttl = opts.ttlMs ?? 5 * 60 * 1000; // 5 minutes default

  // Return cached results if fresh
  if (cache && now - cache.at < ttl) {
    return cache.routes;
  }

  const root = opts.root || process.cwd();

  // Find all markdown files in content directory
  const files = await fg(["content/**/*.md", "content/**/*.mdx"], {
    cwd: root,
    dot: false,
  });

  // Convert to routes and filter
  const routes = files
    .map((f) => normalizeRoute(f))
    .filter((r): r is string => r !== null)
    .filter((r) => !r.includes("[")) // Ignore dynamic routes
    .sort();

  // Deduplicate
  const unique = Array.from(new Set(routes));

  // Update cache
  cache = { at: now, routes: unique };

  return unique;
}
