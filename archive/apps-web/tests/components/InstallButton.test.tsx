/**
 * Tests for InstallButton component (Phase 4, Session 5)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallButton } from "../../components/catalog/InstallButton";

describe("InstallButton", () => {
  it("renders with default label", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    expect(screen.getByText("Install with AlignTrue")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} label="Get Started" />);

    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("displays download icon", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    const icon = screen.getByRole("button").querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("has proper accessibility label", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    expect(screen.getByLabelText("Install this pack")).toBeInTheDocument();
  });

  it("applies default size classes", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("px-5");
    expect(button.className).toContain("py-2.5");
    expect(button.className).toContain("text-base");
  });

  it("applies large size classes", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} size="large" />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("px-6");
    expect(button.className).toContain("py-3");
    expect(button.className).toContain("text-lg");
  });

  it("has proper styling classes", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-neutral-900");
    expect(button.className).toContain("text-white");
    expect(button.className).toContain("rounded-lg");
    expect(button.className).toContain("hover:bg-neutral-800");
  });

  it("has focus ring for keyboard navigation", () => {
    const onClick = vi.fn();

    render(<InstallButton onClick={onClick} />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("focus:ring-2");
    expect(button.className).toContain("focus:ring-neutral-900");
  });
});
