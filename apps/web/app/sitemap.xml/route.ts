const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

interface Entry {
  url: string;
  lastModified?: string;
}

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
    .map((entry) => {
      const last = entry.lastModified
        ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(entry.url)}</loc>${last}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export const dynamic = "force-static";

export async function GET() {
  const now = new Date().toISOString();

  const entries: Entry[] = [{ url: BASE_URL, lastModified: now }];

  const xml = toXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
