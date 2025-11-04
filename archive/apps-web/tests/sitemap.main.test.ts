import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";

describe("sitemap.main.xml", () => {
  it("produces valid urlset XML with catalog entries", async () => {
    const mod = await import("../app/sitemap.main.xml/route");
    const response = await mod.GET();
    const text = await response.text();

    // Parse XML
    const parser = new XMLParser();
    const parsed = parser.parse(text);

    // Validate structure
    expect(parsed.urlset).toBeTruthy();
    expect(parsed.urlset.url).toBeTruthy();

    // Ensure we have at least static pages
    const urls = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];
    expect(urls.length).toBeGreaterThan(0);

    // Verify URLs contain expected static pages
    const locs = urls.map((u: { loc: string }) => u.loc);
    expect(locs.some((loc: string) => loc.endsWith("/"))).toBe(true); // Homepage
    expect(locs.some((loc: string) => loc.includes("/catalog"))).toBe(true);

    // Verify Content-Type header
    expect(response.headers.get("Content-Type")).toBe("application/xml");
  });
});
