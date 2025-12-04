/**
 * Integration tests for migrate config subcommand
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { parse as parseYaml } from "yaml";

const TEST_DIR = join(process.cwd(), "tests", "tmp", "migrate-config-test");
const CLI_PATH = join(__dirname, "../../dist/index.js");

function runCli(args: string[], options: { encoding?: string } = {}): string {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd: TEST_DIR,
    encoding: options.encoding || "utf-8",
  });
}

describe("Migrate Config Command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("migrate config", () => {
    it("detects legacy team config (mode: team in config.yaml)", () => {
      // Create legacy team config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: team
modules:
  lockfile: true
exporters:
  - cursor
sources:
  - type: local
    path: rules
`,
        "utf-8",
      );

      const output = runCli(["migrate", "config", "--yes"]);
      expect(output).toContain("Migrating to two-file config system");
    });

    it("splits config into personal and team files", () => {
      // Create legacy team config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: team
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: soft
exporters:
  - cursor
sources:
  - type: local
    path: rules
remotes:
  personal: https://github.com/user/private-rules
  shared:
    team: https://github.com/org/team-rules
`,
        "utf-8",
      );

      runCli(["migrate", "config", "--yes"]);

      // Check team config was created
      const teamConfigPath = join(TEST_DIR, ".aligntrue", "config.team.yaml");
      expect(existsSync(teamConfigPath)).toBe(true);
      const teamConfig = parseYaml(readFileSync(teamConfigPath, "utf-8"));
      expect(teamConfig.mode).toBe("team");
      expect(teamConfig.modules.lockfile).toBe(true);
      expect(teamConfig.lockfile.mode).toBe("soft");

      // Check personal config was created
      const personalConfigPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      expect(existsSync(personalConfigPath)).toBe(true);
      const personalConfig = parseYaml(
        readFileSync(personalConfigPath, "utf-8"),
      );
      expect(personalConfig.remotes?.personal).toBe(
        "https://github.com/user/private-rules",
      );
    });

    it("adds config.yaml to .gitignore after migration", () => {
      // Create legacy team config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: team
exporters:
  - cursor
`,
        "utf-8",
      );

      runCli(["migrate", "config", "--yes"]);

      // Check .gitignore was updated
      const gitignorePath = join(TEST_DIR, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(true);
      const gitignoreContent = readFileSync(gitignorePath, "utf-8");
      expect(gitignoreContent).toContain("config.yaml");
      expect(gitignoreContent).toContain("AlignTrue personal config");
    });

    it("supports --dry-run flag", () => {
      // Create legacy team config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: team
exporters:
  - cursor
`,
        "utf-8",
      );

      const output = runCli(["migrate", "config", "--dry-run"]);
      expect(output).toContain("Dry run");

      // Team config should NOT be created in dry run
      const teamConfigPath = join(TEST_DIR, ".aligntrue", "config.team.yaml");
      expect(existsSync(teamConfigPath)).toBe(false);
    });

    it("handles non-team config gracefully", () => {
      // Create a solo config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - cursor
`,
        "utf-8",
      );

      // Command succeeds but shows info message
      const output = runCli(["migrate", "config"]);
      expect(output).toContain("No migration needed");
      expect(output).toContain("Not in team mode");
    });

    it("handles already migrated config gracefully", () => {
      // Create both configs (already migrated)
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
exporters:
  - cursor
`,
        "utf-8",
      );
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.team.yaml"),
        `version: "1"
mode: team
exporters:
  - cursor
`,
        "utf-8",
      );

      // Command succeeds but shows info message
      const output = runCli(["migrate", "config"]);
      expect(output).toContain("No migration needed");
      expect(output).toContain("Already using two-file config system");
    });
  });
});
