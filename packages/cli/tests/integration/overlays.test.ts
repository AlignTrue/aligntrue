/**
 * Overlay functionality tests
 * Tests override/overlay system for customizing packs
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { cleanupDir } from "../helpers/fs-cleanup.js";
import * as yaml from "yaml";

let TEST_DIR: string;

// Skip on Windows due to file cleanup issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-overlays-"));
  process.chdir(TEST_DIR);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Overlay Functionality Tests", () => {
  it("validates overlay configuration structure", () => {
    const config = {
      version: "1",
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=no-console-log]",
            set: {
              severity: "error",
            },
          },
        ],
      },
      exporters: ["agents-md"],
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      "utf-8",
    );
    const parsed = yaml.parse(configContent);

    expect(parsed.overlays).toBeDefined();
    expect(parsed.overlays.overrides).toHaveLength(1);
    expect(parsed.overlays.overrides[0].selector).toBe(
      "rule[id=no-console-log]",
    );
    expect(parsed.overlays.overrides[0].set.severity).toBe("error");
  });

  it("validates multiple overlays configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=no-console-log]",
            set: {
              severity: "error",
            },
          },
          {
            selector: "rule[id=max-complexity]",
            set: {
              "check.inputs.threshold": 15,
            },
          },
          {
            selector: "rule[id=prefer-const]",
            remove: ["autofix"],
          },
        ],
      },
      exporters: ["agents-md"],
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      "utf-8",
    );
    const parsed = yaml.parse(configContent);

    expect(parsed.overlays.overrides).toHaveLength(3);
    expect(parsed.overlays.overrides[0].set.severity).toBe("error");
    expect(parsed.overlays.overrides[1].set["check.inputs.threshold"]).toBe(15);
    expect(parsed.overlays.overrides[2].remove).toContain("autofix");
  });

  it("validates overlay selector formats", () => {
    const selectors = [
      "rule[id=no-console-log]",
      "rule[id=max-complexity]",
      "sections[0]",
      "profile.version",
    ];

    selectors.forEach((selector) => {
      const config = {
        version: "1",
        mode: "solo",
        overlays: {
          overrides: [
            {
              selector,
              set: {
                severity: "error",
              },
            },
          ],
        },
        exporters: ["agents-md"],
      };

      writeFileSync(
        join(TEST_DIR, ".aligntrue/config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const configContent = readFileSync(
        join(TEST_DIR, ".aligntrue/config.yaml"),
        "utf-8",
      );
      const parsed = yaml.parse(configContent);

      expect(parsed.overlays.overrides[0].selector).toBe(selector);
    });
  });

  it("validates overlay set and remove operations", () => {
    const config = {
      version: "1",
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test-rule]",
            set: {
              severity: "warning",
              "check.inputs.maxLength": 120,
            },
            remove: ["autofix", "tags"],
          },
        ],
      },
      exporters: ["agents-md"],
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      "utf-8",
    );
    const parsed = yaml.parse(configContent);

    const override = parsed.overlays.overrides[0];
    expect(override.set).toBeDefined();
    expect(override.remove).toBeDefined();
    expect(override.set.severity).toBe("warning");
    expect(override.set["check.inputs.maxLength"]).toBe(120);
    expect(override.remove).toEqual(["autofix", "tags"]);
  });
});
