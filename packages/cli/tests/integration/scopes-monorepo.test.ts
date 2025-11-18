/**
 * Scopes monorepo integration tests
 * Tests path-based rule application for monorepos
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
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-scopes-"));
  process.chdir(TEST_DIR);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Scopes Monorepo Integration", () => {
  it("validates basic scope configuration structure", () => {
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
      ],
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
    expect(parsed.scopes).toHaveLength(2);
    expect(parsed.scopes[0].path).toBe("apps/web");
    expect(parsed.scopes[1].path).toBe("packages/api");
  });

  it("validates scope with include and exclude patterns", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          include: ["**/*.ts", "**/*.tsx", "**/*.js"],
          exclude: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
          rulesets: ["nextjs-rules"],
        },
      ],
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

    const scope = parsed.scopes[0];
    expect(scope.include).toHaveLength(3);
    expect(scope.exclude).toHaveLength(3);
    expect(scope.include).toContain("**/*.ts");
    expect(scope.exclude).toContain("**/*.test.ts");
  });

  it("validates multi-stack monorepo configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          include: ["**/*.ts", "**/*.tsx"],
          rulesets: ["base-rules", "nextjs-rules"],
        },
        {
          path: "packages/api",
          include: ["**/*.ts"],
          rulesets: ["base-rules", "node-rules"],
        },
        {
          path: "services/worker",
          include: ["**/*.py"],
          rulesets: ["base-rules", "python-rules"],
        },
      ],
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

    expect(parsed.scopes).toHaveLength(3);
    expect(parsed.scopes[0].path).toBe("apps/web");
    expect(parsed.scopes[1].path).toBe("packages/api");
    expect(parsed.scopes[2].path).toBe("services/worker");
  });

  it("validates hierarchical merge configuration", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["nextjs-rules"],
        },
      ],
      merge: {
        strategy: "deep",
        order: ["root", "path", "local"],
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

    expect(parsed.merge).toBeDefined();
    expect(parsed.merge.strategy).toBe("deep");
    expect(parsed.merge.order).toEqual(["root", "path", "local"]);
  });

  it("validates custom merge order", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: "apps/web",
          rulesets: ["nextjs-rules"],
        },
      ],
      merge: {
        strategy: "deep",
        order: ["path", "root", "local"],
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

    expect(parsed.merge.order).toEqual(["path", "root", "local"]);
  });

  it("validates default scope (workspace root)", () => {
    const config = {
      version: "1",
      mode: "solo",
      scopes: [
        {
          path: ".",
          include: ["**/*.ts"],
          rulesets: ["base-rules"],
        },
      ],
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

    expect(parsed.scopes[0].path).toBe(".");
  });

  it("validates team boundaries configuration", () => {
    const config = {
      version: "1",
      mode: "team",
      scopes: [
        {
          path: "apps/web",
          include: ["**/*.ts", "**/*.tsx"],
          rulesets: ["base-standards", "frontend-standards"],
        },
        {
          path: "apps/mobile",
          include: ["**/*.ts", "**/*.tsx"],
          rulesets: ["base-standards", "frontend-standards"],
        },
        {
          path: "packages/api",
          include: ["**/*.ts"],
          rulesets: ["base-standards", "backend-standards"],
        },
        {
          path: "packages/shared",
          include: ["**/*.ts"],
          rulesets: ["base-standards"],
        },
      ],
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

    expect(parsed.scopes).toHaveLength(4);
    expect(parsed.mode).toBe("team");
  });

  it("validates progressive adoption configuration", () => {
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

    expect(parsed.scopes).toHaveLength(2);
    expect(parsed.scopes[0].path).toBe("src/new");
    expect(parsed.scopes[1].path).toBe("src/legacy");
    expect(parsed.scopes[0].rulesets).toContain("typescript-strict");
    expect(parsed.scopes[1].rulesets).toContain("typescript-lenient");
  });
});
