import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as yaml from "yaml";

// Mock clack
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
  })),
  confirm: vi.fn(() => Promise.resolve(true)),
  isCancel: vi.fn(() => false),
  select: vi.fn(() => Promise.resolve("keep-both")),
  cancel: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
}));

// Mock source-resolver to avoid actual network calls
vi.mock("../../src/utils/source-resolver.js", () => ({
  importRules: vi.fn(() =>
    Promise.resolve({
      rules: [],
      conflicts: [],
      source: "test",
      sourceType: "local",
    }),
  ),
}));

// Mock spinner
vi.mock("../../src/utils/spinner.js", () => ({
  createManagedSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    stopSilent: vi.fn(),
  })),
}));

// Mock sync command
vi.mock("../../src/commands/sync/index.js", () => ({
  sync: vi.fn(() => Promise.resolve()),
}));

describe("add command", () => {
  const testDir = join(tmpdir(), "temp-add-cli-test");
  const aligntrueDir = join(testDir, ".aligntrue");
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(aligntrueDir, { recursive: true });
    mkdirSync(join(aligntrueDir, "rules"), { recursive: true });

    // Create sample config
    const config = {
      mode: "solo",
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["agents"],
    };
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe("subcommand parsing", () => {
    it("should parse 'add link' subcommand", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add(["link", "https://github.com/test/rules"]);

      // Verify source was added to config
      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.sources).toHaveLength(2);
      expect(config.sources[1]).toEqual({
        type: "git",
        url: "https://github.com/test/rules",
        personal: true,
      });
    });

    it("should parse 'add link --personal' flag", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add(["link", "https://github.com/test/rules", "--personal"]);

      // Verify source was added with personal flag
      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.sources).toHaveLength(2);
      expect(config.sources[1]).toEqual({
        type: "git",
        url: "https://github.com/test/rules",
        personal: true,
        gitignore: true,
      });
    });

    it("should parse 'add remote' subcommand", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add(["remote", "https://github.com/test/backup"]);

      // Verify remote was added to config
      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.remotes).toBeDefined();
      expect(config.remotes.personal).toBe("https://github.com/test/backup");
    });

    it("should parse 'add remote --personal' flag", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add(["remote", "https://github.com/test/backup", "--personal"]);

      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.remotes.personal).toBe("https://github.com/test/backup");
    });

    it("should parse 'add remote --shared' flag", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add(["remote", "https://github.com/test/shared", "--shared"]);

      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.remotes.shared).toBe("https://github.com/test/shared");
    });

    it("should use one-time copy mode when no subcommand", async () => {
      const { add } = await import("../../src/commands/add.js");
      const { importRules } =
        await import("../../src/utils/source-resolver.js");

      await add(["./local/path", "--no-sync"]);

      // Verify importRules was called (one-time copy mode)
      expect(importRules).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should reject --personal and --shared together for remote", async () => {
      // Reset modules to avoid caching issues
      vi.resetModules();

      // Mock exitWithError to throw so we can catch it in tests
      vi.doMock("../../src/utils/error-formatter.js", () => ({
        exitWithError: vi.fn((error) => {
          throw error;
        }),
      }));

      const { add } = await import("../../src/commands/add.js");

      // This should call exitWithError which we've mocked to throw
      await expect(async () => {
        await add([
          "remote",
          "https://github.com/test/rules",
          "--personal",
          "--shared",
        ]);
      }).rejects.toMatchObject({
        code: "INVALID_OPTIONS",
      });
    });
  });

  describe("source already exists", () => {
    it("should not add duplicate source", async () => {
      const { add } = await import("../../src/commands/add.js");

      // Add source first time
      await add(["source", "https://github.com/test/rules"]);

      // Try to add same source again
      await add(["source", "https://github.com/test/rules"]);

      // Verify only one source was added (besides the default local)
      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      // Should still only have 2 sources (default + the one we added)
      expect(config.sources).toHaveLength(2);
    });
  });

  describe("remote with branch", () => {
    it("should add remote with branch ref", async () => {
      const { add } = await import("../../src/commands/add.js");

      await add([
        "remote",
        "https://github.com/test/backup",
        "--ref",
        "develop",
      ]);

      const configContent = readFileSync(
        join(aligntrueDir, "config.yaml"),
        "utf-8",
      );
      const config = yaml.parse(configContent);

      expect(config.remotes.personal).toEqual({
        url: "https://github.com/test/backup",
        branch: "develop",
      });
    });
  });
});
