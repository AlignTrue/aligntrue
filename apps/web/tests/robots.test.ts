import { describe, it, expect } from "vitest";

describe("robots.txt", () => {
  it("includes sitemap reference", async () => {
    const mod = await import("../app/robots.txt/route");
    const response = await mod.GET();
    const text = await response.text();

    // Verify required directives
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Sitemap:");
    expect(text).toContain("/sitemap.xml");

    // Verify Content-Type header
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });

  it("uses correct site URL format", async () => {
    const mod = await import("../app/robots.txt/route");
    const response = await mod.GET();
    const text = await response.text();

    // Sitemap URL should be absolute
    const sitemapLine = text
      .split("\n")
      .find((line) => line.startsWith("Sitemap:"));
    expect(sitemapLine).toBeTruthy();

    if (sitemapLine) {
      const url = sitemapLine.split("Sitemap:")[1]?.trim();
      expect(url).toMatch(/^https?:\/\//); // Should be absolute URL
    }
  });
});
