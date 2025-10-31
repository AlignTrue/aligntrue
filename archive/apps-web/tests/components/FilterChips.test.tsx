/**
 * FilterChips component tests (Phase 4, Session 2)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChips } from "@/components/catalog/FilterChips";

describe("FilterChips", () => {
  const mockOptions = ["cursor", "claude-code", "warp"];

  it("should render all options", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        label="Tools"
      />,
    );

    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Warp")).toBeInTheDocument();
  });

  it("should show selected state", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={["cursor"]}
        onChange={onChange}
        label="Tools"
      />,
    );

    const cursorButton = screen.getByRole("listitem", {
      name: /remove cursor/i,
    });
    expect(cursorButton).toHaveAttribute("aria-pressed", "true");
  });

  it("should toggle selection on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        label="Tools"
      />,
    );

    const cursorButton = screen.getByText("Cursor");
    await user.click(cursorButton);

    expect(onChange).toHaveBeenCalledWith(["cursor"]);
  });

  it("should remove selection on click when already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={["cursor", "warp"]}
        onChange={onChange}
        label="Tools"
      />,
    );

    const cursorButton = screen.getByText("Cursor");
    await user.click(cursorButton);

    expect(onChange).toHaveBeenCalledWith(["warp"]);
  });

  it("should show clear all button when selections exist", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={["cursor"]}
        onChange={onChange}
        label="Tools"
      />,
    );

    expect(screen.getByText(/clear all/i)).toBeInTheDocument();
  });

  it("should hide clear all button when no selections", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        label="Tools"
      />,
    );

    expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();
  });

  it("should clear all selections", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={["cursor", "warp"]}
        onChange={onChange}
        label="Tools"
      />,
    );

    const clearButton = screen.getByText(/clear all/i);
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("should have correct ARIA labels", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        options={mockOptions}
        selected={[]}
        onChange={onChange}
        label="Tools"
        ariaLabel="Filter by compatible tools"
      />,
    );

    const group = screen.getByRole("group", {
      name: "Filter by compatible tools",
    });
    expect(group).toBeInTheDocument();
  });
});
