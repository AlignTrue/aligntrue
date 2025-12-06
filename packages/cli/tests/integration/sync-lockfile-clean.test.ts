/**
 * Ensures lockfile stays clean across consecutive syncs (no drift warning).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import yaml from "yaml";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Sync lockfile remains clean on consecutive runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testProjectContext = setupTestProject();
    TEST_DIR = testProjectContext.projectDir;
    process.chdir(TEST_DIR);

    // Mock process.exit to throw so tests can catch
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Minimal clack mocks
    const mockSpinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
  });

  it("sync twice without reporting lockfile drift", async () => {
    // Basic config and rule
    const config = {
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["agents"],
      modules: { lockfile: true },
      mode: "team",
    };
    const aligntrueDir = join(TEST_DIR, ".aligntrue");
    mkdirSync(aligntrueDir, { recursive: true });
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );
    const rulesDir = join(aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "test-rule.md"),
      `---
title: Test Rule
---

# Test Rule

content
`,
      "utf-8",
    );

    const { sync } = await import("../../src/commands/sync/index.js");
    const warnSpy = vi.spyOn(clack.log, "warn").mockImplementation(() => {});

    // First sync (generates lockfile)
    try {
      await sync([]);
    } catch {
      // process.exit mocked
    }

    warnSpy.mockClear();

    // Second sync should not report lockfile drift
    try {
      await sync([]);
    } catch {
      // process.exit mocked
    }

    const warns = warnSpy.mock.calls.map((c) => (c[0] as string) ?? "");
    expect(
      warns.some((msg) => /lockfile/i.test(msg) && /drift/i.test(msg)),
    ).toBe(false);
  });
});
