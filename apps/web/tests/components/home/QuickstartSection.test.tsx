/**
 * Tests for QuickstartSection component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickstartSection } from "@/components/home/QuickstartSection";

describe("QuickstartSection", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock clipboard API
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });
  });

  it("should render hero heading", () => {
    render(<QuickstartSection />);

    expect(screen.getByText("Try AlignTrue in 30 seconds")).toBeTruthy();
    expect(
      screen.getByText(
        /get started with ai-native rules and alignment for your code agents/i,
      ),
    ).toBeTruthy();
  });

  it("should render installation command", () => {
    render(<QuickstartSection />);

    expect(
      screen.getByText("curl -fsSL https://aligntrue.ai/install.sh | bash"),
    ).toBeTruthy();
  });

  it("should render add command with --from=catalog_web flag", () => {
    render(<QuickstartSection />);

    expect(
      screen.getByText(
        /aligntrue add aligntrue\/aligns:packs\/base\/base-global --from=catalog_web/,
      ),
    ).toBeTruthy();
  });

  it("should copy install script when button clicked", async () => {
    render(<QuickstartSection />);

    const buttons = screen.getAllByRole("button", { name: /copy command/i });
    const installButton = buttons[0];

    fireEvent.click(installButton);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        "curl -fsSL https://aligntrue.ai/install.sh | bash",
      );
    });
  });

  it("should copy add command when button clicked", async () => {
    render(<QuickstartSection />);

    const buttons = screen.getAllByRole("button", { name: /copy command/i });
    const addButton = buttons[1];

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        "aligntrue add aligntrue/aligns:packs/base/base-global --from=catalog_web",
      );
    });
  });

  it("should show copied state after successful copy", async () => {
    render(<QuickstartSection />);

    const buttons = screen.getAllByRole("button", { name: /copy command/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      // Use getAllByText since "Copied!" appears for both copy buttons
      const copiedMatches = screen.getAllByText("Copied!");
      expect(copiedMatches.length).toBeGreaterThan(0);
    });
  });

  it("should render Browse 11 packs link", () => {
    render(<QuickstartSection />);

    const link = screen.getByRole("link", { name: /browse 11 packs/i });
    expect(link.getAttribute("href")).toBe("/catalog");
  });

  it("should render feature highlights", () => {
    render(<QuickstartSection />);

    expect(screen.getByText("43+")).toBeTruthy();
    expect(screen.getByText("Exporter formats")).toBeTruthy();

    expect(screen.getByText("28+")).toBeTruthy();
    expect(screen.getByText("AI coding agents")).toBeTruthy();

    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Deterministic")).toBeTruthy();
  });

  it("should render both steps with numbers", () => {
    render(<QuickstartSection />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Install the CLI")).toBeTruthy();

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/add your first pack/i)).toBeTruthy();
  });

  it("should use theme-aware Tailwind classes", () => {
    const { container } = render(<QuickstartSection />);

    const section = container.querySelector("section");
    expect(section).toBeTruthy();

    // Check that section uses Tailwind classes with CSS variables
    const className = section?.className;
    expect(className).toContain("bg-[var(--bgColor-emphasis)]");
    expect(className).toContain("text-[var(--fgColor-onEmphasis)]");
  });
});
