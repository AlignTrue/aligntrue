import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { loadIRAndResolvePlugs } from "../../src/sync/ir-loader.js";
import { ExporterBase } from "../../../exporters/src/base/exporter-base.js";

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "aligntrue-plugs-"));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe("loadIRAndResolvePlugs", () => {
  it("resolves plugs into section content when fills provided", async () => {
    const rulesDir = join(workspace, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });
    const rulePath = join(rulesDir, "plug.md");

    writeFileSync(
      rulePath,
      `---
description: plug test
plugs:
  slots:
    test.cmd:
      description: cmd
      format: command
      required: true
---

Run tests with: [[plug:test.cmd]]
`,
      "utf-8",
    );

    const result = await loadIRAndResolvePlugs(rulesDir, {
      plugFills: { "test.cmd": "pnpm test" },
    });

    expect(result.success).toBe(true);
    expect(result.ir.sections[0]?.content).toContain("pnpm test");
    expect(result.unresolvedPlugsCount).toBe(0);
  });

  it("sets nested_location from nested rules path", async () => {
    const nestedRulesDir = join(
      workspace,
      "apps",
      "docs",
      ".aligntrue",
      "rules",
    );
    mkdirSync(nestedRulesDir, { recursive: true });
    const rulePath = join(nestedRulesDir, "web_stack.md");

    writeFileSync(
      rulePath,
      `---
description: Web stack
---

# Docs rule
`,
      "utf-8",
    );

    const result = await loadIRAndResolvePlugs(nestedRulesDir);
    expect(result.success).toBe(true);
    expect(result.ir.sections[0]?.source_file).toContain(".aligntrue/rules");

    // Use exporter conversion to verify nested_location is derived for exports
    class TestExporter extends ExporterBase {
      name = "test";
      version = "0.0.0";

      async export() {
        throw new Error("not implemented");
      }
      public convert(sections: typeof result.ir.sections) {
        return this.convertSectionsToRules(sections || []);
      }
    }

    const exporter = new TestExporter();
    const rules = exporter.convert(result.ir.sections);
    expect(rules[0]).toBeDefined();
    expect(rules[0]?.path).toContain(".aligntrue/rules");
    expect(rules[0]?.frontmatter.nested_location).toBe("apps/docs");
  });
});
