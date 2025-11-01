import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";

describe("sitemap.docs.xml", () => {
  it("produces valid urlset with /docs prefix on all URLs", async () => {
    const mod = await import("../app/sitemap.docs.xml/route");
    const response = await mod.GET();
    const text = await response.text();

    // Parse XML
    const parser = new XMLParser();
    const parsed = parser.parse(text);

    // Validate structure
    expect(parsed.urlset).toBeTruthy();

    // Handle both single and multiple URLs
    const urls = parsed.urlset.url
      ? Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url]
      : [];

    // Should have at least some docs pages
    expect(urls.length).toBeGreaterThan(0);

    // Extract locations
    const locs = urls.map((u: { loc: string }) => u.loc);

    // All URLs should contain /docs prefix
    for (const loc of locs) {
      expect(loc).toContain("/docs/");
    }

    // Verify Content-Type header
    expect(response.headers.get("Content-Type")).toBe("application/xml");
  });

  it("discovers routes from content directory", async () => {
    const { getAllDocRoutes } = await import("../lib/docs-routes");
    const routes = await getAllDocRoutes();

    // Should find routes
    expect(routes.length).toBeGreaterThan(0);

    // Routes should not include file extensions
    for (const route of routes) {
      expect(route).not.toMatch(/\.(md|mdx)$/);
    }

    // Routes should not include _meta files
    for (const route of routes) {
      expect(route).not.toContain("_meta");
    }

    // Should have root route for index.mdx
    expect(routes).toContain("/");
  });
});
