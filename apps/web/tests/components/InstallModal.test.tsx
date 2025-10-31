/**
 * Tests for InstallModal component (Phase 4, Session 5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import { InstallModal } from "../../components/catalog/InstallModal";
import { createTestPack } from "../lib/test-utils";

vi.mock("react-dom", async () => {
  const original = await vi.importActual("react-dom");
  return {
    ...original,
    createPortal: (node: React.ReactNode) => node,
  };
});

describe("InstallModal", () => {
  beforeEach(() => {
    // The modal uses a portal, so we need a target element in the DOM
    const portalRoot = document.createElement("div");
    portalRoot.id = "__next";
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders modal when open", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    expect(
      screen.getByText(/Follow these steps to add this pack/),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={false} onClose={onClose} />);

    expect(screen.queryByText("Install Test Pack")).not.toBeInTheDocument();
  });

  it("displays CLI installation step", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    expect(screen.getByText("Install AlignTrue CLI")).toBeInTheDocument();
    expect(screen.getByText(/curl -fsSL/)).toBeInTheDocument();
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("displays pack add command with tracking flag", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    expect(screen.getByText("Add pack")).toBeInTheDocument();
    const command = screen.getByText(
      /aligntrue add catalog:packs\/base\/test-pack@1\.0\.0 --from=catalog_web/,
    );
    expect(command).toBeInTheDocument();
  });

  it("displays plug configuration commands for required plugs", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 2,
      required_plugs: [
        {
          key: "test.cmd",
          description: "Test command",
          type: "command",
          default: "pnpm test",
        },
        {
          key: "coverage.threshold",
          description: "Coverage threshold",
          type: "text",
        },
      ],
    });
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    expect(screen.getByText("Configure test.cmd")).toBeInTheDocument();
    expect(
      screen.getByText("Configure coverage.threshold"),
    ).toBeInTheDocument();
    expect(screen.getByText("Test command")).toBeInTheDocument();
    expect(screen.getByText("Coverage threshold")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close modal");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when ESC key pressed", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop clicked", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const backdrop = screen.getByRole("dialog").parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("does not close when modal content clicked", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const content = screen.getByRole("dialog");
    fireEvent.click(content);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("copies individual command to clipboard", async () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const copyButtons = screen.getAllByText("Copy");
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("curl -fsSL"),
      );
    });

    expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
  });

  it("copies all commands to clipboard", async () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const copyAllButton = screen.getByText("Copy all commands");
    fireEvent.click(copyAllButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("# Install AlignTrue CLI"),
      );
    });

    expect(screen.getByText("✓ Copied all!")).toBeInTheDocument();
  });

  it("downloads YAML when download button clicked", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const downloadButton = screen.getByText("Download YAML");
    fireEvent.click(downloadButton);

    expect(document.body.appendChild).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("displays tracking transparency note", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    expect(screen.getByText(/--from=catalog_web/)).toBeInTheDocument();
    expect(
      screen.getByText(/This is transparent tracking/),
    ).toBeInTheDocument();
  });

  it("shows step numbers correctly", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 1,
      required_plugs: [
        {
          key: "test.cmd",
          description: "Test command",
          type: "command",
        },
      ],
    });
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    // Should have steps 1, 2, 3
    const stepNumbers = screen.getAllByText(/^[123]$/);
    expect(stepNumbers).toHaveLength(3);
  });

  it("focuses close button when modal opens", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close modal");
    expect(document.activeElement).toBe(closeButton);
  });

  it("prevents body scroll when open", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    const { rerender } = render(
      <InstallModal pack={pack} open={true} onClose={onClose} />,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(<InstallModal pack={pack} open={false} onClose={onClose} />);

    expect(document.body.style.overflow).toBe("");
  });
});
