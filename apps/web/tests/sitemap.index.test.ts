import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";

describe("sitemap.xml (index)", () => {
  it("lists both sub-sitemaps", async () => {
    const mod = await import("../app/sitemap.xml/route");
    const response = await mod.GET();
    const text = await response.text();

    // Parse XML
    const parser = new XMLParser();
    const parsed = parser.parse(text);

    // Validate structure
    expect(parsed.sitemapindex).toBeTruthy();
    expect(parsed.sitemapindex.sitemap).toBeTruthy();

    // Get sitemap entries
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];

    // Extract locations
    const locs = sitemaps.map((s: { loc: string }) => s.loc);

    // Verify both sub-sitemaps are present
    expect(locs).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/sitemap.main.xml"),
        expect.stringContaining("/sitemap.docs.xml"),
      ]),
    );

    // Verify we have exactly 2 sitemaps
    expect(locs).toHaveLength(2);

    // Verify Content-Type header
    expect(response.headers.get("Content-Type")).toBe("application/xml");
  });
});
