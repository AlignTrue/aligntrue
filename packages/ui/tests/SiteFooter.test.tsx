import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../src/components/SiteFooter";

describe("SiteFooter", () => {
  it("renders the tagline", () => {
    render(<SiteFooter />);
    const tagline = screen.getByText("Made with ❤️ + hash determinism.");
    expect(tagline).toBeDefined();
  });

  it("renders copyright with current year and MIT license link", () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();

    // Check copyright text (split across elements, so use partial match)
    const copyright = screen.getByText(new RegExp(`© ${year} AlignTrue`));
    expect(copyright).toBeDefined();

    // Check that there's a link with MIT License text in the copyright section
    const miLinks = screen.getAllByText("MIT License");
    expect(miLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders build and status badges", () => {
    render(<SiteFooter />);

    // Check npm version badge
    const npmBadge = screen.getByAltText("npm version");
    expect(npmBadge).toBeDefined();
    expect(npmBadge.getAttribute("src")).toContain("@aligntrue/cli");

    // Check license badge
    const licenseBadge = screen.getByAltText("MIT License");
    expect(licenseBadge).toBeDefined();
    expect(licenseBadge.getAttribute("src")).toContain("license-MIT");

    // Check test status badge
    const testBadge = screen.getByAltText("test status");
    expect(testBadge).toBeDefined();
    expect(testBadge.getAttribute("src")).toContain("github/actions/workflow");
  });

  it("renders badges as clickable links", () => {
    render(<SiteFooter />);

    // npm badge should link to npm package
    const npmLink = screen.getByRole("link", {
      name: /npm version/i,
    });
    expect(npmLink.getAttribute("href")).toBe(
      "https://www.npmjs.com/package/@aligntrue/cli",
    );

    // Get all license links and check the badge link
    const allLinks = screen.getAllByRole("link");
    const licenseBadgeLink = allLinks.find(
      (link) =>
        link.getAttribute("href") ===
          "https://github.com/AlignTrue/aligntrue/blob/main/LICENSE" &&
        link.querySelector("img[alt='MIT License']"),
    );
    expect(licenseBadgeLink).toBeDefined();
    expect(licenseBadgeLink?.getAttribute("href")).toBe(
      "https://github.com/AlignTrue/aligntrue/blob/main/LICENSE",
    );

    // test badge should link to GitHub actions
    const testLink = screen.getByRole("link", {
      name: /test status/i,
    });
    expect(testLink.getAttribute("href")).toBe(
      "https://github.com/AlignTrue/aligntrue/actions",
    );
  });
});
