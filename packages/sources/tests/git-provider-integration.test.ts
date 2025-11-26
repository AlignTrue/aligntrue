import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { GitProvider } from "../src/providers/git.js";

const RUN_INTEGRATION = process.env.INTEGRATION === "1";
const describeFn = RUN_INTEGRATION ? describe : describe.skip;

describeFn("GitProvider (integration)", () => {
  const repoUrl = "https://github.com/AlignTrue/examples";
  let cacheDir: string;

  beforeAll(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "aligntrue-git-cache-"));
  });

  afterAll(() => {
    if (cacheDir) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("fetches aligns/testing.md content from examples repo", async () => {
    const provider = new GitProvider(
      {
        type: "git",
        url: repoUrl,
        path: "aligns/testing.md",
      },
      cacheDir,
    );

    const content = await provider.fetch();
    expect(content).toContain("Testing baseline");
    expect(content).toContain("## Determinism Requirements");
  });

  it("reuses cache on subsequent fetches", async () => {
    const provider = new GitProvider(
      {
        type: "git",
        url: repoUrl,
        path: "aligns/debugging.md",
      },
      cacheDir,
    );

    const first = await provider.fetch();
    expect(first).toContain("Systematic debugging");

    const second = await provider.fetch();
    expect(second).toEqual(first);
  });

  it("throws helpful error when file path is missing", async () => {
    const provider = new GitProvider(
      {
        type: "git",
        url: repoUrl,
        path: "aligns/does-not-exist.md",
      },
      cacheDir,
    );

    await expect(provider.fetch()).rejects.toThrow(
      /Rules file not found in repository/,
    );
  });
});
