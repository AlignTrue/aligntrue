import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { add } from "../../src/commands/add.js";
import type { RuleFile } from "@aligntrue/schema";

vi.mock("../../src/utils/tty-helper.js", () => ({
  isTTY: () => true,
}));

let confirmResponse = true;

vi.mock("@clack/prompts", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    stopSilent: vi.fn(),
  })),
  confirm: vi.fn(() => Promise.resolve(confirmResponse)),
  isCancel: vi.fn(() => false),
  select: vi.fn(() => Promise.resolve("replace")),
  cancel: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
}));

vi.mock("../../src/commands/sync/index.js", () => ({
  sync: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/utils/catalog-resolver.js", () => ({
  isCatalogId: vi.fn(() => true),
  extractCatalogId: vi.fn((id: string) => id),
}));

vi.mock("../../src/utils/catalog-import.js", () => ({
  importFromCatalog: vi.fn(
    async (_id: string, _targetDir: string, _cwd: string) => {
      const rule: RuleFile = {
        content: "Hello catalog",
        frontmatter: { title: "Catalog Rule" },
        path: ".aligntrue/rules/catalog-rule.md",
        filename: "catalog-rule.md",
        relativePath: "catalog-rule.md",
        hash: "hash",
      };
      return {
        kind: "pack" as const,
        title: "Test Pack",
        rules: [rule],
        warnings: [],
      };
    },
  ),
}));

describe("add command - catalog import", () => {
  const testDir = join(__dirname, "..", "..", "..", "temp-add-catalog-test");
  const aligntrueDir = join(testDir, ".aligntrue");
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    confirmResponse = true;

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(join(aligntrueDir, "rules"), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("imports catalog ID and writes files", async () => {
    await add(["abc123defgh"]);

    const writtenPath = join(aligntrueDir, "rules", "catalog-rule.md");
    expect(existsSync(writtenPath)).toBe(true);
    const content = readFileSync(writtenPath, "utf-8");
    expect(content).toContain("Catalog Rule");
    expect(content).toContain("Hello catalog");
  });

  it("replaces starter rules when confirmed", async () => {
    // Seed starter files that should be removed
    const starters = [
      "global.md",
      "testing.md",
      "ai-guidance.md",
      "security.md",
    ];
    starters.forEach((name) =>
      writeFileSync(join(aligntrueDir, "rules", name), "# starter", "utf-8"),
    );

    await add(["abc123defgh"]);

    starters.forEach((name) =>
      expect(existsSync(join(aligntrueDir, "rules", name))).toBe(false),
    );
    expect(existsSync(join(aligntrueDir, "rules", "catalog-rule.md"))).toBe(
      true,
    );
  });

  it("keeps starter rules when user declines replacement", async () => {
    confirmResponse = false;
    const starters = [
      "global.md",
      "testing.md",
      "ai-guidance.md",
      "security.md",
    ];
    starters.forEach((name) =>
      writeFileSync(join(aligntrueDir, "rules", name), "# starter", "utf-8"),
    );

    await add(["abc123defgh"]);

    starters.forEach((name) =>
      expect(existsSync(join(aligntrueDir, "rules", name))).toBe(true),
    );
    expect(existsSync(join(aligntrueDir, "rules", "catalog-rule.md"))).toBe(
      true,
    );
  });
});
