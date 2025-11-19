import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GenericMarkdownExporter } from "../../src/base/generic-markdown-exporter.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { join } from "path";
import { existsSync, readFileSync, rmSync, mkdirSync } from "fs";

const TEST_OUTPUT_DIR = join(process.cwd(), "temp-test-generic-markdown-scope");

describe("GenericMarkdownExporter Scope Filtering", () => {
  let exporter: GenericMarkdownExporter;

  beforeEach(() => {
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

    exporter = new GenericMarkdownExporter(
      "test-exporter",
      "TEST.md",
      "TEST.md",
      "for testing",
    );
  });

  afterEach(() => {
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  it("should filter sections by scope", async () => {
    // Create sections for different scopes
    const rootSection: AlignSection = {
      heading: "Root Rule",
      content: "This is a root rule",
      vendor: {
        aligntrue: {
          source_scope: "default",
        },
      },
    };

    const webSection: AlignSection = {
      heading: "Web Rule",
      content: "This is a web rule",
      vendor: {
        aligntrue: {
          source_scope: "apps/web",
        },
      },
    };

    const apiSection: AlignSection = {
      heading: "API Rule",
      content: "This is an API rule",
      vendor: {
        aligntrue: {
          source_scope: "apps/api",
        },
      },
    };

    const pack: AlignPack = {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1.0.0",
      sections: [rootSection, webSection, apiSection],
    };

    const scope: ResolvedScope = {
      path: ".",
      normalizedPath: ".",
      isDefault: true,
    };

    const options: ExportOptions = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };

    // 1. Export for root scope
    const rootScope: ResolvedScope = {
      path: ".",
      normalizedPath: ".",
      isDefault: true,
    };

    const rootResult = await exporter.export(
      {
        scope: rootScope,
        pack,
        outputPath: TEST_OUTPUT_DIR,
      },
      options,
    );

    expect(rootResult.success).toBe(true);
    expect(rootResult.filesWritten.length).toBe(1);

    // Check root file
    const rootPath = join(TEST_OUTPUT_DIR, "TEST.md");
    expect(existsSync(rootPath)).toBe(true);
    const rootContent = readFileSync(rootPath, "utf-8");
    expect(rootContent).toContain("Root Rule");
    expect(rootContent).not.toContain("Web Rule");
    expect(rootContent).not.toContain("API Rule");

    // 2. Export for web scope
    const webScope: ResolvedScope = {
      path: "apps/web",
      normalizedPath: "apps/web",
      isDefault: false,
    };

    const webResult = await exporter.export(
      {
        scope: webScope,
        pack,
        outputPath: TEST_OUTPUT_DIR,
      },
      options,
    );

    expect(webResult.success).toBe(true);
    expect(webResult.filesWritten.length).toBe(1);

    // Check web file
    const webPath = join(TEST_OUTPUT_DIR, "apps/web/TEST.md");
    expect(existsSync(webPath)).toBe(true);
    const webContent = readFileSync(webPath, "utf-8");
    expect(webContent).toContain("Web Rule");
    expect(webContent).not.toContain("Root Rule");
    expect(webContent).not.toContain("API Rule");

    // 3. Export for API scope
    const apiScope: ResolvedScope = {
      path: "apps/api",
      normalizedPath: "apps/api",
      isDefault: false,
    };

    const apiResult = await exporter.export(
      {
        scope: apiScope,
        pack,
        outputPath: TEST_OUTPUT_DIR,
      },
      options,
    );

    expect(apiResult.success).toBe(true);
    expect(apiResult.filesWritten.length).toBe(1);

    // Check API file
    const apiPath = join(TEST_OUTPUT_DIR, "apps/api/TEST.md");
    expect(existsSync(apiPath)).toBe(true);
    const apiContent = readFileSync(apiPath, "utf-8");
    expect(apiContent).toContain("API Rule");
    expect(apiContent).not.toContain("Root Rule");
    expect(apiContent).not.toContain("Web Rule");
  });

  it("should handle sections without explicit source_scope (fallback to current scope)", async () => {
    const section: AlignSection = {
      heading: "Implicit Scope Rule",
      content: "This rule has no explicit source_scope",
    };

    const pack: AlignPack = {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1.0.0",
      sections: [section],
    };

    const scope: ResolvedScope = {
      path: "apps/web",
      normalizedPath: "apps/web",
      isDefault: false,
    };

    const request: ScopedExportRequest = {
      scope,
      pack,
      outputPath: TEST_OUTPUT_DIR,
    };

    const options: ExportOptions = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };

    await exporter.export(request, options);

    // Should be written to apps/web/TEST.md
    const webPath = join(TEST_OUTPUT_DIR, "apps/web/TEST.md");
    expect(existsSync(webPath)).toBe(true);
    const content = readFileSync(webPath, "utf-8");
    expect(content).toContain("Implicit Scope Rule");

    // Should NOT be written to root
    const rootPath = join(TEST_OUTPUT_DIR, "TEST.md");
    expect(existsSync(rootPath)).toBe(false);
  });
});
