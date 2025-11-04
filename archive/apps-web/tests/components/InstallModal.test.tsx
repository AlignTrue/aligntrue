/**
 * Tests for InstallModal component (Phase 4, Session 5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  let originalClipboard: typeof navigator.clipboard;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The modal uses a portal, so we need a target element in the DOM
    const portalRoot = document.createElement("div");
    portalRoot.id = "__next";
    document.body.appendChild(portalRoot);

    // Mock clipboard API
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock document.body methods for download (AFTER adding portal root)
    appendChildSpy = vi.spyOn(document.body, "appendChild") as any;
    removeChildSpy = vi.spyOn(document.body, "removeChild") as any;

    // Mock URL methods for download
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    // Restore clipboard
    Object.assign(navigator, { clipboard: originalClipboard });

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();

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
    // Check for command parts in the document
    const commandText = document.body.textContent || "";
    expect(commandText).toContain("aligntrue add");
    expect(commandText).toContain(`catalog:${pack.id}@${pack.version}`);
    expect(commandText).toContain("--from=catalog_web");
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

    const commandText = document.body.textContent || "";
    expect(commandText).toContain("Configure test.cmd");
    expect(commandText).toContain("Configure coverage.threshold");
    expect(commandText).toContain("Test command");
    expect(commandText).toContain("Coverage threshold");
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

    // The dialog itself is the backdrop with the click handler
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when modal content clicked", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    // Find a child element within the modal content
    const titleElement = screen.getByText(`Install ${pack.name}`);
    fireEvent.click(titleElement);

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

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    const downloadButton = screen.getByText("Download YAML");
    fireEvent.click(downloadButton);

    expect(appendChildSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("displays tracking transparency note", () => {
    const pack = createTestPack();
    const onClose = vi.fn();

    render(<InstallModal pack={pack} open={true} onClose={onClose} />);

    // Use getAllByText since --from=catalog_web appears multiple times
    const matches = screen.getAllByText(/--from=catalog_web/);
    expect(matches.length).toBeGreaterThan(0);
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

    // Count the number of steps displayed
    const commandText = document.body.textContent || "";
    expect(commandText).toContain("Install AlignTrue CLI");
    expect(commandText).toContain("Add pack");
    expect(commandText).toContain("Configure test.cmd");
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
