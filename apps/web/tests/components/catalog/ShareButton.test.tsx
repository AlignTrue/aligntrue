/**
 * Tests for ShareButton component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareButton } from "@/components/catalog/ShareButton";

describe("ShareButton", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock clipboard API
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    // Mock window.location
    delete (window as any).location;
    window.location = { origin: "https://aligntrue.ai" } as any;

    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should render share button", () => {
    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", { name: /share base global/i });
    expect(button).toBeTruthy();
    expect(screen.getByText("Share")).toBeTruthy();
  });

  it("should generate URL with UTM parameters", async () => {
    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", { name: /share base global/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(
        "https://aligntrue.ai/catalog/base-global?utm_source=share&utm_medium=copy",
      );
    });
  });

  it("should show copied state after successful copy", async () => {
    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", { name: /share base global/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeTruthy();
    });
  });

  it("should reset copied state after 2 seconds", async () => {
    vi.useFakeTimers();

    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", { name: /share base global/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeTruthy();
    });

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText("Share")).toBeTruthy();
    });

    vi.useRealTimers();
  });

  it("should handle clipboard copy failure gracefully", async () => {
    writeTextSpy.mockRejectedValue(new Error("Clipboard access denied"));

    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", { name: /share base global/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to copy share link:",
        expect.any(Error),
      );
    });

    // Should not show copied state on error
    expect(screen.queryByText("Copied!")).toBeFalsy();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <ShareButton
        packSlug="base-global"
        packName="Base Global"
        className="custom-class"
      />,
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("custom-class");
  });

  it("should have accessible label", () => {
    render(<ShareButton packSlug="base-global" packName="Base Global" />);

    const button = screen.getByRole("button", {
      name: /share base global/i,
    });
    expect(button.getAttribute("aria-label")).toBe("Share Base Global");
  });
});
