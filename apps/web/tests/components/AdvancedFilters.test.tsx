/**
 * AdvancedFilters component tests (Phase 4, Session 2)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedFilters } from "@/components/catalog/AdvancedFilters";

describe("AdvancedFilters", () => {
  const mockLicenses = ["MIT", "Apache-2.0", "GPL-3.0"];

  it("should render collapsed by default", () => {
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        {...handlers}
        defaultCollapsed={true}
      />,
    );

    expect(
      screen.queryByLabelText(/filter by license/i),
    ).not.toBeInTheDocument();
  });

  it("should expand when clicked", async () => {
    const user = userEvent.setup();
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        {...handlers}
        defaultCollapsed={true}
      />,
    );

    const toggle = screen.getByText(/advanced filters/i);
    await user.click(toggle);

    expect(screen.getByLabelText(/filter by license/i)).toBeInTheDocument();
  });

  it("should call onLicenseChange when license selected", async () => {
    const user = userEvent.setup();
    const onLicenseChange = vi.fn();
    const handlers = {
      onLicenseChange,
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        {...handlers}
        defaultCollapsed={false}
      />,
    );

    const select = screen.getByLabelText(/filter by license/i);
    await user.selectOptions(select, "MIT");

    expect(onLicenseChange).toHaveBeenCalledWith("MIT");
  });

  it("should call onHasPlugsChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const onHasPlugsChange = vi.fn();
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange,
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        {...handlers}
        defaultCollapsed={false}
      />,
    );

    const checkbox = screen.getByLabelText(/filter packs with plugs/i);
    await user.click(checkbox);

    expect(onHasPlugsChange).toHaveBeenCalledWith(true);
  });

  it("should call onOverlayFriendlyChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const onOverlayFriendlyChange = vi.fn();
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange,
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        {...handlers}
        defaultCollapsed={false}
      />,
    );

    const checkbox = screen.getByLabelText(/filter overlay-friendly/i);
    await user.click(checkbox);

    expect(onOverlayFriendlyChange).toHaveBeenCalledWith(true);
  });

  it("should show clear button when filters active", () => {
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        selectedLicense="MIT"
        {...handlers}
        defaultCollapsed={false}
      />,
    );

    expect(screen.getByText(/clear advanced filters/i)).toBeInTheDocument();
  });

  it("should clear all filters when clear clicked", async () => {
    const user = userEvent.setup();
    const handlers = {
      onLicenseChange: vi.fn(),
      onLastUpdatedChange: vi.fn(),
      onHasPlugsChange: vi.fn(),
      onOverlayFriendlyChange: vi.fn(),
    };

    render(
      <AdvancedFilters
        licenses={mockLicenses}
        selectedLicense="MIT"
        hasPlugs={true}
        {...handlers}
        defaultCollapsed={false}
      />,
    );

    const clearButton = screen.getByText(/clear advanced filters/i);
    await user.click(clearButton);

    expect(handlers.onLicenseChange).toHaveBeenCalledWith(undefined);
    expect(handlers.onLastUpdatedChange).toHaveBeenCalledWith(undefined);
    expect(handlers.onHasPlugsChange).toHaveBeenCalledWith(undefined);
    expect(handlers.onOverlayFriendlyChange).toHaveBeenCalledWith(undefined);
  });
});
