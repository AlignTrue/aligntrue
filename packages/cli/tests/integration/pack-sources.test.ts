/**
 * Integration coverage for pack sources merging.
 * Ensures local pack overlays merge into IR *after* two-way sync.
 *
 * Skip: This test suite relies on the old bidirectional sync architecture
 * which has been removed in the Ruler-style refactor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, copyFileSync } from "fs";
import { join, resolve } from "path";
import * as clack from "@clack/prompts";
import { sync } from "../../src/commands/sync/index.js";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";
import { mockProcessExit, ProcessExitError } from "../helpers/exit-mock.js";

vi.mock("@clack/prompts");

const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

// Skip: Bidirectional sync and pack merging behavior changed in Ruler-style refactor
describeSkipWindows.skip("Pack Sources Integration", () => {
  let testProject: TestProjectContext;
  let exitMock: ReturnType<typeof mockProcessExit>;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();

    const configYaml = `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/.rules.yaml
  - type: local
    path: debugging.md
exporters:
  - cursor
  - agents
sync:
  edit_source: AGENTS.md
`;

    const rulesYaml = `id: base-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Base Section
    content: Base content.
    level: 2
    fingerprint: base-section
`;

    testProject = setupTestProject({
      customConfig: configYaml,
      customRules: rulesYaml,
    });

    originalCwd = process.cwd();
    process.chdir(testProject.projectDir);

    exitMock = mockProcessExit();

    const mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
    };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.spyOn(clack.log, "info").mockImplementation(() => {});
    vi.spyOn(clack.log, "success").mockImplementation(() => {});
    vi.spyOn(clack.log, "warn").mockImplementation(() => {});

    writeFileSync(
      join(testProject.projectDir, "AGENTS.md"),
      "## AGENTS\n\n## Base Section\n\nBase content.\n",
      "utf-8",
    );

    const packPath = resolve(
      __dirname,
      "../../../../examples/packs/debugging.md",
    );
    copyFileSync(packPath, join(testProject.projectDir, "debugging.md"));
  });

  afterEach(async () => {
    exitMock.restore();
    process.chdir(originalCwd);
    await testProject.cleanup();
  });

  it("merges pack sources before exporting to agents", async () => {
    try {
      await sync([]);
    } catch (error) {
      if (!(error instanceof ProcessExitError)) {
        throw error;
      }
    }

    const agentsMd = readFileSync(
      join(testProject.projectDir, "AGENTS.md"),
      "utf-8",
    );
    expect(agentsMd).toContain("Debugging Workflow");
    expect(agentsMd).toContain("Regression Prevention");

    const irContent = readFileSync(
      join(testProject.projectDir, ".aligntrue/.rules.yaml"),
      "utf-8",
    );
    expect(irContent).toContain("Debugging Workflow");
  });
});
