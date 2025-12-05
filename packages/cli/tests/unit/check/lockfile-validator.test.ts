import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { AlignTrueConfig } from "@aligntrue/core";
import { validateLockfileForCheck } from "../../../src/commands/check/lockfile-validator.js";

describe("lockfile-validator", () => {
  it("skips validation in solo mode", async () => {
    const config = { mode: "solo" } as AlignTrueConfig;

    const result = await validateLockfileForCheck(config, process.cwd());

    expect(result.status).toBe("skipped");
  });

  it("reports missing lockfile in team mode", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "aligntrue-lockfile-"));
    const config = {
      mode: "team",
      modules: { lockfile: true },
    } as AlignTrueConfig;

    const result = await validateLockfileForCheck(config, cwd);

    expect(result.status).toBe("missing");
    expect(result.lockfilePath).toBe(join(cwd, ".aligntrue", "lock.json"));
  });
});
