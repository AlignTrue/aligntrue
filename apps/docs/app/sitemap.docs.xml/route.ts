import { getAllDocRoutes } from "../../lib/docs-routes";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";
const DOCS_PREFIX = "/docs";

interface Entry {
  url: string;
  lastModified?: string;
}

function toXml(entries: Entry[]): string {
  const body = entries
    .map((e) => {
      const last = e.lastModified ? `<lastmod>${e.lastModified}</lastmod>` : "";
      return `<url><loc>${e.url}</loc>${last}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export async function GET() {
  const now = new Date().toISOString();

  // Discover all doc routes
  const docPaths = await getAllDocRoutes();

  // Build entries with /docs prefix
  const entries: Entry[] = docPaths.map((p) => ({
    url: `${BASE_URL}${DOCS_PREFIX}${p}`,
    lastModified: now,
  }));

  const xml = toXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
