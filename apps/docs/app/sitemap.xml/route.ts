import { getAllDocRoutes } from "../../lib/docs-routes";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

interface Entry {
  url: string;
  lastModified?: string;
}

/**
 * Escape XML entities to prevent injection attacks
 * Escapes: & < > " '
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toXml(entries: Entry[]): string {
  const body = entries
    .map((e) => {
      const last = e.lastModified
        ? `<lastmod>${escapeXml(e.lastModified)}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(e.url)}</loc>${last}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export async function GET() {
  const now = new Date().toISOString();

  // Discover all doc routes
  const docPaths = await getAllDocRoutes();

  // Build entries - homepage and docs pages
  const entries: Entry[] = docPaths.map((p) => {
    // Root path maps to homepage, others get /docs prefix
    const url = p === "/" ? BASE_URL : `${BASE_URL}/docs${p}`;
    return {
      url,
      lastModified: now,
    };
  });

  const xml = toXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
