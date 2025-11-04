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

    // Check MIT License link
    const licenseLink = screen.getByRole("link", { name: /MIT License/i });
    expect(licenseLink.getAttribute("href")).toBe(
      "https://github.com/AlignTrue/aligntrue/blob/main/LICENSE",
    );
  });
});
