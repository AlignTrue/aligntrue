/**
 * AlignTrueLogo Component Tests
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  AlignTrueLogo,
  AlignTrueLogoText,
} from "../src/components/AlignTrueLogo";

describe("AlignTrueLogo", () => {
  it("renders without crashing", () => {
    const { container } = render(<AlignTrueLogo />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("has proper accessibility attributes", () => {
    const { container } = render(<AlignTrueLogo />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-labelledby")).toBe("aligntrue-logo-title");
    expect(container.querySelector("title")).toBeTruthy();
  });

  it("renders with default medium size", () => {
    const { container } = render(<AlignTrueLogo />);
    const wrapper = container.querySelector("div");

    // Default is "md" which maps to height 28px
    expect(wrapper?.style.height).toBe("28px");
  });

  it("renders with small size", () => {
    const { container } = render(<AlignTrueLogo size="sm" />);
    const wrapper = container.querySelector("div");

    expect(wrapper?.style.height).toBe("20px");
  });

  it("renders with large size", () => {
    const { container } = render(<AlignTrueLogo size="lg" />);
    const wrapper = container.querySelector("div");

    expect(wrapper?.style.height).toBe("36px");
  });

  it("renders with custom numeric size", () => {
    const { container } = render(<AlignTrueLogo size={50} />);
    const wrapper = container.querySelector("div");

    expect(wrapper?.style.height).toBe("50px");
  });

  it("includes custom className", () => {
    const { container } = render(<AlignTrueLogo className="custom-class" />);
    const wrapper = container.querySelector("div");

    expect(wrapper?.className).toContain("custom-class");
  });

  it("contains wordmark path element", () => {
    const { container } = render(<AlignTrueLogo />);
    const wordmark = container.querySelector(".aligntrue-wordmark");

    expect(wordmark).toBeTruthy();
    expect(wordmark?.querySelector("path")).toBeTruthy();
  });

  it("contains accent (colon) path element", () => {
    const { container } = render(<AlignTrueLogo />);
    const accent = container.querySelector(".aligntrue-accent");

    expect(accent).toBeTruthy();
    expect(accent?.querySelector("path")).toBeTruthy();
  });

  it("contains embedded styles for color inheritance", () => {
    const { container } = render(<AlignTrueLogo />);
    const style = container.querySelector("style");

    expect(style).toBeTruthy();
    expect(style?.textContent).toContain("aligntrue-wordmark");
    expect(style?.textContent).toContain("aligntrue-accent");
  });
});

describe("AlignTrueLogoText", () => {
  it("renders text variant without crashing", () => {
    const { container } = render(<AlignTrueLogoText />);
    expect(container.querySelector("span")).toBeTruthy();
  });

  it("contains all text parts", () => {
    const { container } = render(<AlignTrueLogoText />);
    const text = container.textContent;

    expect(text).toBe("align:True");
  });

  it("styles colon with brand accent variable", () => {
    const { container } = render(<AlignTrueLogoText />);
    const colon = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === ":",
    );

    expect(colon?.style.color).toBe("var(--brand-accent, #F5A623)");
  });

  it("includes custom className", () => {
    const { container } = render(<AlignTrueLogoText className="custom-text" />);
    const span = container.querySelector("span");

    expect(span?.className).toContain("custom-text");
  });
});
