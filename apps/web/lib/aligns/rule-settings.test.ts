import { describe, expect, it } from "vitest";

import {
  extractRuleSettings,
  humanizeGlobs,
  hasNonDefaultSettings,
  stripFrontmatter,
} from "./rule-settings";

const content = `---
globs:
  - "**/*.ts"
  - "src/**/*.tsx"
apply_to: agent_requested
scope: apps/web
---

# Title

Body here.
`;

describe("rule-settings", () => {
  it("extracts readable settings from frontmatter", () => {
    const settings = extractRuleSettings(content);
    expect(settings.appliesTo).toBe("**/*.ts, src/**/*.tsx");
    expect(settings.activation).toBe("Manual activation");
    expect(settings.scope).toBe("apps/web");
  });

  it("handles missing values gracefully", () => {
    const settings = extractRuleSettings("# No frontmatter");
    expect(settings.appliesTo).toBeNull();
    expect(settings.activation).toBeNull();
    expect(settings.scope).toBeNull();
  });

  it("strips frontmatter from content", () => {
    const body = stripFrontmatter(content);
    expect(body.trim()).toContain("Body here.");
    expect(body).not.toContain("globs:");
  });

  it("humanizes globs", () => {
    expect(humanizeGlobs(["**/*.ts"])).toBe("**/*.ts");
    expect(humanizeGlobs(["a", "b"])).toBe("a, b");
    expect(humanizeGlobs([])).toBeNull();
  });

  it("detects when settings differ from defaults", () => {
    const defaults = { appliesTo: null, activation: null, scope: null };
    expect(hasNonDefaultSettings(defaults)).toBe(false);

    expect(
      hasNonDefaultSettings({
        appliesTo: "**/*.ts",
        activation: null,
        scope: null,
      }),
    ).toBe(true);
    expect(
      hasNonDefaultSettings({
        appliesTo: null,
        activation: "Manual activation",
        scope: null,
      }),
    ).toBe(true);
    expect(
      hasNonDefaultSettings({
        appliesTo: null,
        activation: null,
        scope: "apps/web",
      }),
    ).toBe(true);
  });
});
