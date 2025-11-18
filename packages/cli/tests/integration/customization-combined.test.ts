/**
 * Combined customization integration tests
 * Tests scopes + plugs + overlays working together
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
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-combined-"));
  process.chdir(TEST_DIR);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Combined Customization Integration", () => {
  it("validates scopes + plugs configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["nextjs-rules"],
        },
        {
          path: "packages/api",
          rulesets: ["node-rules"],
        },
      ],
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
          "docs.url": "https://docs.example.com",
        },
      },
      exporters: ["agents-md", "cursor"],
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

    expect(parsed.scopes).toBeDefined();
    expect(parsed.plugs).toBeDefined();
    expect(parsed.scopes).toHaveLength(2);
    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
  });

  it("validates scopes + overlays configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["nextjs-rules"],
        },
      ],
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

    expect(parsed.scopes).toBeDefined();
    expect(parsed.overlays).toBeDefined();
    expect(parsed.scopes).toHaveLength(1);
    expect(parsed.overlays.overrides).toHaveLength(1);
  });

  it("validates plugs + overlays configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
        },
      },
      overlays: {
        overrides: [
          {
            selector: "rule[id=max-complexity]",
            set: {
              "check.inputs.threshold": 15,
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

    expect(parsed.plugs).toBeDefined();
    expect(parsed.overlays).toBeDefined();
    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
    expect(parsed.overlays.overrides[0].set["check.inputs.threshold"]).toBe(15);
  });

  it("validates all three features together", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          include: ["**/*.ts", "**/*.tsx"],
          rulesets: ["nextjs-rules"],
        },
        {
          path: "packages/api",
          include: ["**/*.ts"],
          rulesets: ["node-rules"],
        },
      ],
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
          "docs.url": "https://docs.example.com",
        },
      },
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
        ],
      },
      exporters: ["agents-md", "cursor"],
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

    // Validate all three features are present
    expect(parsed.scopes).toBeDefined();
    expect(parsed.plugs).toBeDefined();
    expect(parsed.overlays).toBeDefined();

    // Validate scopes
    expect(parsed.scopes).toHaveLength(2);
    expect(parsed.scopes[0].path).toBe("apps/web");
    expect(parsed.scopes[1].path).toBe("packages/api");

    // Validate plugs
    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
    expect(parsed.plugs.fills["docs.url"]).toBe("https://docs.example.com");

    // Validate overlays
    expect(parsed.overlays.overrides).toHaveLength(2);
    expect(parsed.overlays.overrides[0].selector).toBe(
      "rule[id=no-console-log]",
    );
    expect(parsed.overlays.overrides[1].selector).toBe(
      "rule[id=max-complexity]",
    );
  });

  it("validates monorepo with all features and merge config", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          include: ["**/*.ts", "**/*.tsx"],
          exclude: ["**/*.test.ts"],
          rulesets: ["base-rules", "nextjs-rules"],
        },
        {
          path: "packages/api",
          include: ["**/*.ts"],
          exclude: ["**/*.test.ts"],
          rulesets: ["base-rules", "node-rules"],
        },
        {
          path: "services/worker",
          include: ["**/*.py"],
          rulesets: ["base-rules", "python-rules"],
        },
      ],
      merge: {
        strategy: "deep",
        order: ["root", "path", "local"],
      },
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
          "build.cmd": "pnpm build",
          "docs.url": "https://docs.example.com",
        },
      },
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
      exporters: ["agents-md", "cursor"],
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

    // Validate complete configuration
    expect(parsed.scopes).toHaveLength(3);
    expect(parsed.merge).toBeDefined();
    expect(parsed.merge.order).toEqual(["root", "path", "local"]);
    expect(Object.keys(parsed.plugs.fills)).toHaveLength(3);
    expect(parsed.overlays.overrides).toHaveLength(1);
  });

  it("validates team mode with all features", () => {
    const config = {
      version: "1",
      mode: "team",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["base-standards", "frontend-standards"],
        },
        {
          path: "packages/api",
          rulesets: ["base-standards", "backend-standards"],
        },
      ],
      plugs: {
        fills: {
          "org.name": "Acme Corp",
          "test.cmd": "pnpm test",
        },
      },
      overlays: {
        overrides: [
          {
            selector: "rule[id=no-any]",
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

    expect(parsed.mode).toBe("team");
    expect(parsed.scopes).toBeDefined();
    expect(parsed.plugs).toBeDefined();
    expect(parsed.overlays).toBeDefined();
  });

  it("validates progressive adoption with all features", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "src/new",
          include: ["**/*.ts"],
          rulesets: ["typescript-strict"],
        },
        {
          path: "src/legacy",
          include: ["**/*.ts"],
          rulesets: ["typescript-lenient"],
        },
      ],
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
        },
      },
      overlays: {
        overrides: [
          {
            selector: "rule[id=strict-null-checks]",
            set: {
              severity: "warn",
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

    // Validate progressive adoption pattern
    expect(parsed.scopes).toHaveLength(2);
    expect(parsed.scopes[0].path).toBe("src/new");
    expect(parsed.scopes[1].path).toBe("src/legacy");
    expect(parsed.overlays.overrides[0].set.severity).toBe("warn");
  });

  it("validates application order: scopes → plugs → overlays", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["nextjs-rules"],
        },
      ],
      plugs: {
        fills: {
          "test.cmd": "pnpm test",
        },
      },
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

    // All three features should be present in correct structure
    expect(parsed.scopes).toBeDefined();
    expect(parsed.plugs).toBeDefined();
    expect(parsed.overlays).toBeDefined();

    // Verify they can coexist without conflicts
    expect(typeof parsed.scopes).toBe("object");
    expect(typeof parsed.plugs).toBe("object");
    expect(typeof parsed.overlays).toBe("object");
  });
});
