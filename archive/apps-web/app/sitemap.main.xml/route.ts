import { listCatalogEntries } from "@/lib/catalog";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

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

  // Static top-level pages
  const staticPages = ["/", "/catalog"];
  const staticEntries: Entry[] = staticPages.map((p) => ({
    url: `${BASE_URL}${p}`,
    lastModified: now,
  }));

  // Catalog entries from index.json
  const catalog = await listCatalogEntries();
  const catalogEntries: Entry[] = catalog.map((c) => ({
    url: `${BASE_URL}/catalog/${c.slug}`,
    lastModified: c.lastModified || now,
  }));

  const xml = toXml([...staticEntries, ...catalogEntries]);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
