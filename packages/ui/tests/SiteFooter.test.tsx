import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../src/components/SiteFooter";

describe("SiteFooter", () => {
  it("renders the tagline", () => {
    render(<SiteFooter />);
    const tagline = screen.getByText("Made with ❤️ and hash determinism.");
    expect(tagline).toBeDefined();
  });

  it("renders copyright with current year", () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    const copyright = screen.getByText(`© ${year} AlignTrue. MIT Licensed.`);
    expect(copyright).toBeDefined();
  });

  it("renders GitHub repository links", () => {
    render(<SiteFooter />);
    const aligntrueLink = screen.getByRole("link", {
      name: /aligntrue \(MIT\)/i,
    });
    const alignsLink = screen.getByRole("link", { name: /aligns \(CC0\)/i });

    expect(aligntrueLink.getAttribute("href")).toBe(
      "https://github.com/AlignTrue/aligntrue",
    );
    expect(alignsLink.getAttribute("href")).toBe(
      "https://github.com/AlignTrue/aligns",
    );
  });

  it("renders npm version badge", () => {
    render(<SiteFooter />);
    const badge = screen.getByAltText("npm version");
    expect(badge.getAttribute("src")).toBe(
      "https://img.shields.io/npm/v/@aligntrue/cli.svg",
    );
  });

  it("renders tests passing badge", () => {
    render(<SiteFooter />);
    const badge = screen.getByAltText("Tests passing");
    expect(badge.getAttribute("src")).toBe(
      "https://img.shields.io/badge/tests-1842%20passing-brightgreen",
    );
  });

  it("renders MIT license badge", () => {
    render(<SiteFooter />);
    const badge = screen.getByAltText("MIT License");
    expect(badge.getAttribute("src")).toBe(
      "https://img.shields.io/badge/License-MIT-blue.svg",
    );
  });

  it("renders the logo", () => {
    render(<SiteFooter />);
    // AlignTrueLogo should be rendered with aria-label
    const logo = screen.getByLabelText("AlignTrue");
    expect(logo).toBeDefined();
  });
});
