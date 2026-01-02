import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";

describe("sitemap.xml", () => {
  it("produces valid urlset with homepage and /docs prefixed URLs", async () => {
    const mod = await import("../app/sitemap.xml/route");
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

    // Should have at least some pages
    expect(urls.length).toBeGreaterThan(0);

    // Extract locations
    const locs = urls.map((u: { loc: string }) => u.loc);

    // Should have docs homepage
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";
    const docsBaseUrl = `${baseUrl}/docs`;

    expect(locs).toContain(docsBaseUrl);

    // Other URLs should contain /docs prefix (except homepage)
    const nonHomepageUrls = locs.filter((loc: string) => loc !== docsBaseUrl);
    for (const loc of nonHomepageUrls) {
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

  it("escapes XML entities to prevent injection", async () => {
    const mod = await import("../app/sitemap.xml/route");
    const response = await mod.GET();
    const text = await response.text();

    // Verify XML is well-formed (parser would fail if entities not escaped)
    const parser = new XMLParser();
    const parsed = parser.parse(text);
    expect(parsed.urlset).toBeTruthy();

    // Check raw XML text for proper escaping
    // URLs and dates should not contain unescaped XML special characters
    const urls = parsed.urlset.url
      ? Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url]
      : [];

    // Verify no unescaped ampersands in XML text (should be &amp;)
    // This regex finds & not followed by valid entity name
    expect(text).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);

    // Verify no unescaped angle brackets in content (outside of XML tags)
    // Content between tags should not contain < or >
    const locMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
    for (const match of locMatches) {
      const content = match[1];
      expect(content).not.toContain("<");
      expect(content).not.toContain(">");
    }

    // All URLs should be valid strings after parsing
    for (const url of urls) {
      expect(url.loc).toBeTruthy();
      expect(typeof url.loc).toBe("string");
      if (url.lastmod) {
        expect(typeof url.lastmod).toBe("string");
      }
    }
  });
});

describe("robots.txt", () => {
  it("produces valid robots.txt with sitemap reference", async () => {
    const mod = await import("../app/robots.txt/route");
    const response = await mod.GET();
    const text = await response.text();

    // Should contain standard directives
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");

    // Should reference sitemap.xml
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";
    expect(text).toContain(`Sitemap: ${baseUrl}/sitemap.xml`);

    // Verify Content-Type header
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });
});
