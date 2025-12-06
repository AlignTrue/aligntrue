import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { readFileSync } from "fs";
import { remove } from "../../src/commands/remove.js";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

vi.mock("@clack/prompts", () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
}));

describe("remove command", () => {
  let project: TestProjectContext;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    project = setupTestProject({
      customConfig: [
        "mode: solo",
        "sources:",
        "  - type: local",
        "    path: .aligntrue/rules",
        "  - type: git",
        "    url: https://example.com/rules.git",
        "exporters:",
        "  - agents",
      ].join("\n"),
    });
    process.chdir(project.projectDir);

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
    await project.cleanup();
  });

  it("returns non-zero when no matching source is removed", async () => {
    await expect(
      remove(["https://not-configured.example.com/rules.git"]),
    ).rejects.toThrow("process.exit(2)");

    const errors = errorSpy.mock.calls.flat().join(" ");
    expect(errors).toContain("No source found matching");
    expect(errors).toContain("not-configured.example.com");
  });

  it("removes the matching source and keeps others intact", async () => {
    await remove(["https://example.com/rules.git"]);

    expect(exitSpy).not.toHaveBeenCalled();

    const config = readFileSync(
      join(project.projectDir, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    expect(config).not.toContain("https://example.com/rules.git");
    expect(config).toContain(".aligntrue/rules");
  });
});
