import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { remotes } from "../../src/commands/remotes.js";
import { backupCommand } from "../../src/commands/backup.js";
import { AlignTrueError } from "../../src/utils/error-types.js";

const TEST_DIR = join(
  process.cwd(),
  "tests",
  "tmp",
  "remotes-backup-no-remotes",
);

const originalCwd = process.cwd();

describe("Remotes/Backup - no remotes configured", () => {
  beforeEach(() => {
    process.chdir(originalCwd);
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
exporters:
  - agents
`,
      "utf-8",
    );
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "rules", "rule.md"),
      "# Rule\n\nBody\n",
      "utf-8",
    );
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("remotes push exits non-zero when remotes are missing", async () => {
    await expect(remotes(["push", "--dry-run"])).rejects.toMatchObject({
      exitCode: 2,
      message: "No remotes configured",
    } satisfies Partial<AlignTrueError>);
  });

  it("backup push exits non-zero when remotes are missing", async () => {
    await expect(backupCommand(["push", "--dry-run"])).rejects.toMatchObject({
      exitCode: 2,
      message: "No remotes configured",
    } satisfies Partial<AlignTrueError>);
  });
});
