/**
 * CopyBlock component tests (Phase 4, Session 3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyBlock } from "@/components/catalog/CopyBlock";
import { createTestPack } from "../lib/test-utils";

describe("CopyBlock", () => {
  const mockPackWithoutPlugs = createTestPack({
    id: "packs/base/base-global",
    slug: "base-global",
    name: "Base Global",
    plugs: [],
  });

  const mockPackWithPlugs = createTestPack({
    id: "packs/base/base-global",
    slug: "base-global",
    name: "Base Global",
    plugs: [
      {
        key: "test.cmd",
        description: "Test command to run",
        type: "string",
        default: "npm test",
        required: true,
      },
      {
        key: "coverage.threshold",
        description: "Minimum coverage percentage",
        type: "number",
        default: "80",
        required: true,
      },
    ],
  });

  // Mock clipboard API
  let clipboardText = "";
  beforeEach(() => {
    clipboardText = "";
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn((text: string) => {
            clipboardText = text;
            return Promise.resolve(true);
          }),
        },
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
        async (text: string) => {
          clipboardText = text;
          return true;
        },
      );
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render installation heading", () => {
    render(<CopyBlock pack={mockPackWithoutPlugs} />);
    expect(
      screen.getByRole("heading", { name: "Installation" }),
    ).toBeInTheDocument();
  });

  it("should generate basic install command without plugs", () => {
    render(<CopyBlock pack={mockPackWithoutPlugs} />);
    const preview = screen.getByText(
      /aligntrue add packs\/base\/base-global@1.0.0 --from=catalog_web/,
    );
    expect(preview).toBeInTheDocument();
  });

  it("should include --from=catalog_web tracking flag", () => {
    render(<CopyBlock pack={mockPackWithoutPlugs} />);
    expect(screen.getByText(/--from=catalog_web/)).toBeInTheDocument();
  });

  it("should render plug input fields when pack has required plugs", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);
    expect(screen.getByLabelText(/test.cmd/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/coverage.threshold/i)).toBeInTheDocument();
  });

  it("should show plug type hints", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);
    expect(screen.getByText("(string)")).toBeInTheDocument();
    expect(screen.getByText("(number)")).toBeInTheDocument();
  });

  it("should show plug descriptions", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);
    expect(screen.getByText("Test command to run")).toBeInTheDocument();
    expect(screen.getByText("Minimum coverage percentage")).toBeInTheDocument();
  });

  it("should populate plug inputs with default values", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);
    const testCmdInput = screen.getByLabelText(/test.cmd/i) as HTMLInputElement;
    const coverageInput = screen.getByLabelText(
      /coverage.threshold/i,
    ) as HTMLInputElement;

    expect(testCmdInput.value).toBe("npm test");
    expect(coverageInput.value).toBe("80");
  });

  it("should update live preview when plug values change", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithPlugs} />);

    const testCmdInput = screen.getByLabelText(/test.cmd/i);
    await user.clear(testCmdInput);
    await user.type(testCmdInput, "pnpm test");

    await waitFor(() => {
      expect(
        screen.getByText(/aln plugs set test.cmd "pnpm test"/),
      ).toBeInTheDocument();
    });
  });

  it("should generate plug set commands in install command", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);
    expect(
      screen.getByText(/aln plugs set test.cmd "npm test"/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/aln plugs set coverage.threshold "80"/),
    ).toBeInTheDocument();
  });

  it("should copy install command to clipboard", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithoutPlugs} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy install command to clipboard/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(clipboardText).toContain(
        "aligntrue add packs/base/base-global@1.0.0 --from=catalog_web",
      );
    });
  });

  it("should copy command with plugs to clipboard", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithPlugs} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy install command to clipboard/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(clipboardText).toContain("aligntrue add");
      expect(clipboardText).toContain("aln plugs set test.cmd");
      expect(clipboardText).toContain("aln plugs set coverage.threshold");
    });
  });

  it("should show success message after copying", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithoutPlugs} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy install command to clipboard/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
    });
  });

  it("should reset success message after timeout", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithoutPlugs} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy install command to clipboard/i,
    });

    await user.click(copyButton);

    // Success message should appear
    await waitFor(() => {
      expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
    });

    // Wait for it to disappear (CopyBlock uses 2000ms timeout)
    await waitFor(
      () => {
        expect(screen.queryByText("✓ Copied!")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("should have link to CLI docs", () => {
    render(<CopyBlock pack={mockPackWithoutPlugs} />);
    const link = screen.getByRole("link", {
      name: /View CLI installation guide/i,
    });
    expect(link).toHaveAttribute("href", "/docs/quickstart");
  });

  it("should have accessible labels for plug inputs", () => {
    render(<CopyBlock pack={mockPackWithPlugs} />);

    const testCmdInput = screen.getByLabelText(/test.cmd/i);
    expect(testCmdInput).toHaveAttribute("id", "plug-test.cmd");
    expect(testCmdInput).toHaveAttribute(
      "aria-describedby",
      "plug-test.cmd-desc",
    );

    const description = screen.getByText("Test command to run");
    expect(description).toHaveAttribute("id", "plug-test.cmd-desc");
  });

  it("should handle empty plug values gracefully", async () => {
    const user = userEvent.setup();
    render(<CopyBlock pack={mockPackWithPlugs} />);

    const testCmdInput = screen.getByLabelText(/test.cmd/i);
    await user.clear(testCmdInput);

    const copyButton = screen.getByRole("button", {
      name: /Copy install command to clipboard/i,
    });
    await user.click(copyButton);

    // Wait for clipboard to be written
    await waitFor(() => {
      expect(clipboardText).toContain("aligntrue add");
    });

    // Empty values still use defaults if available, so verify default value is used
    // The component falls back to default value "npm test" when input is empty
    expect(clipboardText).toContain('aln plugs set test.cmd "npm test"');
  });
});
