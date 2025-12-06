import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { sources } from "../../src/commands/sources.js";
import { AlignTrueError } from "../../src/utils/error-types.js";

vi.mock("../../src/utils/tty-helper.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/utils/tty-helper.js")
  >("../../src/utils/tty-helper.js");
  return {
    ...actual,
    isTTY: () => false,
  };
});

const TEST_DIR = join(process.cwd(), "tests", "tmp", "sources-split");
const originalCwd = process.cwd();

describe("sources split non-interactive guard", () => {
  beforeEach(() => {
    process.chdir(originalCwd);
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      join(TEST_DIR, "AGENTS.md"),
      `# Agent Rules

## Section A
Content A

## Section B
Content B
`,
    );
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("exits with guidance when run without --yes in non-TTY", async () => {
    await expect(sources(["split"])).rejects.toMatchObject({
      exitCode: 2,
      message: "Non-interactive environment: use --yes for split",
    } satisfies Partial<AlignTrueError>);
  });
});
