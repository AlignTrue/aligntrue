import { describe, expect, it } from "vitest";
import { join } from "path";
import {
  computeRulePaths,
  updateRulePathsForRename,
  validateRulePaths,
  type RulePathContext,
} from "../../src/rules/rule-paths.js";

const cwd = "/workspace";
const rulesDir = join(cwd, ".aligntrue", "rules");
const ctx: RulePathContext = { cwd, rulesDir };

describe("rule-paths helpers", () => {
  it("computes paths for flat files", () => {
    const absoluteFile = join(rulesDir, "rule.md");
    const paths = computeRulePaths(absoluteFile, ctx);

    expect(paths.filename).toBe("rule.md");
    expect(paths.relativePath).toBe("rule.md");
    expect(paths.path).toBe(".aligntrue/rules/rule.md");
  });

  it("computes paths for nested files", () => {
    const absoluteFile = join(rulesDir, "deep", "nested", "rule.md");
    const paths = computeRulePaths(absoluteFile, ctx);

    expect(paths.filename).toBe("rule.md");
    expect(paths.relativePath).toBe("deep/nested/rule.md");
    expect(paths.path).toBe(".aligntrue/rules/deep/nested/rule.md");
  });

  it("preserves directory structure on rename", () => {
    const current = { relativePath: "deep/rule.md" };
    const paths = updateRulePathsForRename(current, "renamed.md", ctx);

    expect(paths.filename).toBe("renamed.md");
    expect(paths.relativePath).toBe("deep/renamed.md");
    expect(paths.path).toBe(".aligntrue/rules/deep/renamed.md");
  });

  it("validates correct paths successfully", () => {
    const absoluteFile = join(rulesDir, "ok.md");
    const paths = computeRulePaths(absoluteFile, ctx);
    const result = validateRulePaths(paths, ctx);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags incorrect paths", () => {
    const bad = {
      filename: "rule.md",
      relativePath: "other/rule.md",
      path: "somewhere-else/rule.md",
    };
    const result = validateRulePaths(bad, ctx);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
