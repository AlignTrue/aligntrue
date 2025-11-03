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
    expect(svg?.getAttribute("aria-label")).toBe("AlignTrue");
    expect(container.querySelector("title")).toBeTruthy();
  });

  it("renders with default medium size", () => {
    const { container } = render(<AlignTrueLogo />);
    const svg = container.querySelector("svg");

    // Default is "md" which maps to height 28
    expect(svg?.getAttribute("height")).toBe("28");
  });

  it("renders with small size", () => {
    const { container } = render(<AlignTrueLogo size="sm" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("height")).toBe("20");
  });

  it("renders with large size", () => {
    const { container } = render(<AlignTrueLogo size="lg" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("height")).toBe("36");
  });

  it("renders with custom numeric size", () => {
    const { container } = render(<AlignTrueLogo size={50} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("height")).toBe("50");
  });

  it("includes custom className", () => {
    const { container } = render(<AlignTrueLogo className="custom-class" />);
    const svg = container.querySelector("svg");

    expect(svg?.className).toContain("custom-class");
  });

  it("contains align text element", () => {
    const { container } = render(<AlignTrueLogo />);
    const texts = container.querySelectorAll("text");

    expect(texts.length).toBeGreaterThanOrEqual(3); // align, :, True
    expect(texts[0]?.textContent).toBe("align");
  });

  it("contains colon with orange color", () => {
    const { container } = render(<AlignTrueLogo />);
    const texts = container.querySelectorAll("text");

    const colon = Array.from(texts).find((t) => t.textContent === ":");
    expect(colon?.getAttribute("fill")).toBe("#F5A623");
  });

  it("contains True text element", () => {
    const { container } = render(<AlignTrueLogo />);
    const texts = container.querySelectorAll("text");

    const trueText = Array.from(texts).find((t) => t.textContent === "True");
    expect(trueText).toBeTruthy();
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

  it("styles colon with orange color", () => {
    const { container } = render(<AlignTrueLogoText />);
    const colon = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === ":",
    );

    expect(colon?.style.color).toBe("#F5A623");
  });

  it("includes custom className", () => {
    const { container } = render(<AlignTrueLogoText className="custom-text" />);
    const span = container.querySelector("span");

    expect(span?.className).toContain("custom-text");
  });
});
