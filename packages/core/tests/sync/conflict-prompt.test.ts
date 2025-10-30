/**
 * Tests for interactive conflict prompts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  promptForResolution,
  promptForConflicts,
  promptOnChecksumMismatch,
  isInteractive,
  type PromptOptions,
} from "../../src/sync/conflict-prompt.js";
import {
  ConflictResolutionStrategy,
  type Conflict,
} from "../../src/sync/conflict-detector.js";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

describe("ConflictPrompt", () => {
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockConfirm: ReturnType<typeof vi.fn>;
  let mockIsCancel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const clack = await import("@clack/prompts");
    mockSelect = clack.select as ReturnType<typeof vi.fn>;
    mockConfirm = clack.confirm as ReturnType<typeof vi.fn>;
    mockIsCancel = clack.isCancel as ReturnType<typeof vi.fn>;
    mockIsCancel.mockReturnValue(false); // Default: not cancelled
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isInteractive", () => {
    it("returns true when stdin and stdout are TTY", () => {
      const originalStdinIsTTY = process.stdin.isTTY;
      const originalStdoutIsTTY = process.stdout.isTTY;

      process.stdin.isTTY = true;
      process.stdout.isTTY = true;

      expect(isInteractive()).toBe(true);

      process.stdin.isTTY = originalStdinIsTTY;
      process.stdout.isTTY = originalStdoutIsTTY;
    });

    it("returns false when stdin is not TTY", () => {
      const originalStdinIsTTY = process.stdin.isTTY;

      process.stdin.isTTY = false;

      expect(isInteractive()).toBe(false);

      process.stdin.isTTY = originalStdinIsTTY;
    });
  });

  describe("promptForResolution", () => {
    const conflict: Conflict = {
      agent: "cursor",
      ruleId: "testing.require-tests",
      field: "severity",
      irValue: "warn",
      agentValue: "error",
      diff: 'Field: severity\nIR value:\n"warn"\nAgent value:\n"error"',
    };

    it("uses default strategy in non-interactive mode", async () => {
      const options: PromptOptions = {
        interactive: false,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR);
      expect(result.applyToAll).toBe(false);
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("prompts user in interactive mode (keep IR)", async () => {
      mockSelect.mockResolvedValueOnce("keep_ir");

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("prompts user in interactive mode (accept agent)", async () => {
      mockSelect.mockResolvedValueOnce("accept_agent");

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.ACCEPT_AGENT);
    });

    it("handles quit option", async () => {
      mockSelect.mockResolvedValueOnce("quit");

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.ABORT);
      expect(result.applyToAll).toBe(false);
    });

    it("handles cancelled prompt (undefined)", async () => {
      const cancelSymbol = Symbol("cancel");
      mockSelect.mockResolvedValueOnce(cancelSymbol);
      mockIsCancel.mockReturnValueOnce(true);

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.ABORT);
    });

    it("prompts for batch mode when enabled", async () => {
      mockSelect.mockResolvedValueOnce("keep_ir");
      mockConfirm.mockResolvedValueOnce(true);

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: true,
      };

      const result = await promptForResolution(conflict, options);

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR);
      expect(result.applyToAll).toBe(true);
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("promptForConflicts", () => {
    it("processes multiple conflicts", async () => {
      const conflicts: Conflict[] = [
        {
          agent: "cursor",
          ruleId: "testing.require-tests",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
        {
          agent: "cursor",
          ruleId: "style.no-any",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
      ];

      mockSelect
        .mockResolvedValueOnce("keep_ir")
        .mockResolvedValueOnce("accept_agent");

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      const resolutions = await promptForConflicts(conflicts, options);

      expect(resolutions.size).toBe(2);
      expect(resolutions.get("testing.require-tests:severity")).toBe(
        ConflictResolutionStrategy.KEEP_IR,
      );
      expect(resolutions.get("style.no-any:severity")).toBe(
        ConflictResolutionStrategy.ACCEPT_AGENT,
      );
    });

    it("applies batch strategy to remaining conflicts in rule", async () => {
      const conflicts: Conflict[] = [
        {
          agent: "cursor",
          ruleId: "testing.require-tests",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
        {
          agent: "cursor",
          ruleId: "testing.require-tests",
          field: "guidance",
          irValue: "Old guidance",
          agentValue: "New guidance",
          diff: "",
        },
        {
          agent: "cursor",
          ruleId: "style.no-any",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
      ];

      // First conflict: keep_ir with batch mode
      mockSelect.mockResolvedValueOnce("keep_ir");
      mockConfirm.mockResolvedValueOnce(true);
      // Third conflict (different rule)
      mockSelect.mockResolvedValueOnce("accept_agent");
      mockConfirm.mockResolvedValueOnce(false);

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: true,
      };

      const resolutions = await promptForConflicts(conflicts, options);

      expect(resolutions.size).toBe(3);
      // First two should be KEEP_IR (batch applied)
      expect(resolutions.get("testing.require-tests:severity")).toBe(
        ConflictResolutionStrategy.KEEP_IR,
      );
      expect(resolutions.get("testing.require-tests:guidance")).toBe(
        ConflictResolutionStrategy.KEEP_IR,
      );
      // Third is different rule, prompted separately
      expect(resolutions.get("style.no-any:severity")).toBe(
        ConflictResolutionStrategy.ACCEPT_AGENT,
      );
    });

    it("throws on abort", async () => {
      const conflicts: Conflict[] = [
        {
          agent: "cursor",
          ruleId: "testing.require-tests",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
      ];

      mockSelect.mockResolvedValueOnce("quit");

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      };

      await expect(promptForConflicts(conflicts, options)).rejects.toThrow(
        /aborted by user/,
      );
    });

    it("uses default strategy in non-interactive mode", async () => {
      const conflicts: Conflict[] = [
        {
          agent: "cursor",
          ruleId: "testing.require-tests",
          field: "severity",
          irValue: "warn",
          agentValue: "error",
          diff: "",
        },
      ];

      const options: PromptOptions = {
        interactive: false,
        defaultStrategy: ConflictResolutionStrategy.ACCEPT_AGENT,
        batchMode: false,
      };

      const resolutions = await promptForConflicts(conflicts, options);

      expect(resolutions.size).toBe(1);
      expect(resolutions.get("testing.require-tests:severity")).toBe(
        ConflictResolutionStrategy.ACCEPT_AGENT,
      );
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("promptOnChecksumMismatch", () => {
    const filePath = "/path/to/file.txt";
    const lastChecksum = "abc123def456";
    const currentChecksum = "xyz789ghi012";

    it("returns overwrite in non-interactive mode with force", async () => {
      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        false,
        true,
      );

      expect(result).toBe("overwrite");
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns abort in non-interactive mode without force", async () => {
      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        false,
        false,
      );

      expect(result).toBe("abort");
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("prompts user in interactive mode (overwrite)", async () => {
      mockSelect.mockResolvedValueOnce("overwrite");

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false,
      );

      expect(result).toBe("overwrite");
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("prompts user in interactive mode (keep)", async () => {
      mockSelect.mockResolvedValueOnce("keep");

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false,
      );

      expect(result).toBe("keep");
    });

    it("prompts user in interactive mode (abort)", async () => {
      mockSelect.mockResolvedValueOnce("abort");

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false,
      );

      expect(result).toBe("abort");
    });

    it("handles cancelled prompt as abort", async () => {
      const cancelSymbol = Symbol("cancel");
      mockSelect.mockResolvedValueOnce(cancelSymbol);
      mockIsCancel.mockReturnValueOnce(true);

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false,
      );

      expect(result).toBe("abort");
    });
  });
});
