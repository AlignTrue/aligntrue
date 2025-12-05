import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { createEmptyLockfile } from "../../src/utils/lockfile-helpers.js";
import { generateLockfile } from "@aligntrue/core/lockfile";

describe("createEmptyLockfile", () => {
  const makeTempDir = () =>
    mkdtempSync(join(tmpdir(), "aligntrue-lock-empty-"));

  it("matches generateLockfile bundle hash when team config is absent", async () => {
    const cwd = makeTempDir();
    mkdirSync(join(cwd, ".aligntrue"));

    const result = await createEmptyLockfile(cwd, "team");
    expect(result.success).toBe(true);

    const lockfile = JSON.parse(
      readFileSync(join(cwd, ".aligntrue", "lock.json"), "utf-8"),
    );

    const expected = generateLockfile([], cwd);
    expect(lockfile.bundle_hash).toBe(expected.bundle_hash);

    rmSync(cwd, { recursive: true, force: true });
  });

  it("includes team config hash to match generateLockfile when present", async () => {
    const cwd = makeTempDir();
    const alignDir = join(cwd, ".aligntrue");
    mkdirSync(alignDir);
    writeFileSync(join(alignDir, "config.team.yaml"), "mode: team\n");

    const result = await createEmptyLockfile(cwd, "team");
    expect(result.success).toBe(true);

    const lockfile = JSON.parse(
      readFileSync(join(alignDir, "lock.json"), "utf-8"),
    );

    const expected = generateLockfile([], cwd);
    expect(lockfile.bundle_hash).toBe(expected.bundle_hash);

    rmSync(cwd, { recursive: true, force: true });
  });
});
