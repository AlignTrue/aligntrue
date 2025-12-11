import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as yaml from "yaml";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

describe("sync gitignore rule exports", () => {
  beforeEach(async () => {
    testProjectContext = await setupTestProject({ skipFiles: true });
    TEST_DIR = testProjectContext.projectDir;
    originalCwd = process.cwd();
    process.chdir(TEST_DIR);

    // Custom config: cursor exporter, git mode commit to track exports
    const config = {
      mode: "solo",
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["cursor"],
      git: { mode: "commit" },
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );

    const rulesDir = testProjectContext.rulesDir;
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "guardrails.md"),
      [
        "---",
        "title: Guardrails",
        "gitignore: true",
        "---",
        "",
        "## Guidance",
        "Always do the right thing.",
      ].join("\n"),
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
  });

  it("adds per-rule gitignored exports section to .gitignore", async () => {
    await sync([]);

    const gitignorePath = join(TEST_DIR, ".gitignore");
    const content = readFileSync(gitignorePath, "utf-8");

    expect(content).toContain("# START AlignTrue Gitignored Rule Exports");
    expect(content).toContain(".cursor/rules/guardrails.mdc");
    expect(content).toContain("# END AlignTrue Gitignored Rule Exports");
  });
});
