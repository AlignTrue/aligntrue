import { describe, it, expect } from "vitest";
import {
  renderModeMarkers,
  extractMarkerPairs,
} from "../src/utils/mode-markers.js";
import type { AlignRule } from "@aligntrue/schema";

describe("renderModeMarkers", () => {
  const baseRule: AlignRule = {
    id: "test.rule",
    mode: "intelligent",
    description: "Test description",
    applies_to: ["**/*.ts"],
    guidance: "Test guidance",
    severity: "info",
  };

  it("produces empty strings for off mode", () => {
    const result = renderModeMarkers(baseRule, "off");

    expect(result.prefix).toBe("");
    expect(result.suffix).toBe("");
  });

  it("produces empty strings for native mode", () => {
    const result = renderModeMarkers(baseRule, "native");

    expect(result.prefix).toBe("");
    expect(result.suffix).toBe("");
  });

  it("produces markers without hint for metadata_only mode", () => {
    const result = renderModeMarkers(baseRule, "metadata_only");

    expect(result.prefix).toContain("<!-- aligntrue:begin");
    expect(result.prefix).toContain('"id":"test.rule"');
    expect(result.prefix).not.toContain("Execution intent");
    expect(result.suffix).toContain("<!-- aligntrue:end");
  });

  it("produces markers with visible hint for hints mode", () => {
    const result = renderModeMarkers(baseRule, "hints");

    expect(result.prefix).toContain("<!-- aligntrue:begin");
    expect(result.prefix).toContain("> Execution intent:");
    expect(result.prefix).toContain("apply intelligently");
    expect(result.prefix).toContain("**/*.ts");
    expect(result.suffix).toContain("<!-- aligntrue:end");
  });

  it("generates canonical JSON with sorted keys", () => {
    const rule: AlignRule = {
      id: "test.rule",
      tags: ["tag1", "tag2"],
      mode: "always",
      applies_to: ["**/*.ts"],
      guidance: "test",
    };

    const result = renderModeMarkers(rule, "metadata_only");

    // Keys should be alphabetically sorted in JSON
    const jsonMatch = result.prefix.match(/\{[^}]+\}/);
    expect(jsonMatch).toBeTruthy();

    const parsed = JSON.parse(jsonMatch![0]);
    const keys = Object.keys(parsed);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("marker JSON is valid and parseable", () => {
    const result = renderModeMarkers(baseRule, "hints");

    const beginMatch = result.prefix.match(
      /<!--\s*aligntrue:begin\s+(\{[^}]+\})\s*-->/,
    );
    expect(beginMatch).toBeTruthy();

    const markerData = JSON.parse(beginMatch![1]);
    expect(markerData.id).toBe("test.rule");
    expect(markerData.mode).toBe("intelligent");
    expect(markerData.applies_to).toEqual(["**/*.ts"]);
  });

  it("includes only present fields in marker", () => {
    const minimalRule: AlignRule = {
      id: "minimal.rule",
      guidance: "test",
    };

    const result = renderModeMarkers(minimalRule, "metadata_only");
    const beginMatch = result.prefix.match(/\{[^}]+\}/);
    const markerData = JSON.parse(beginMatch![0]);

    expect(markerData.id).toBe("minimal.rule");
    expect(markerData.mode).toBeUndefined();
    expect(markerData.applies_to).toBeUndefined();
    expect(markerData.tags).toBeUndefined();
  });

  it("generates correct intent verbs for different modes", () => {
    const modes = [
      { mode: "always", expectedVerb: "apply automatically" },
      { mode: "intelligent", expectedVerb: "apply intelligently" },
      { mode: "files", expectedVerb: "apply to matching files" },
      { mode: "manual", expectedVerb: "apply manually" },
    ];

    for (const { mode, expectedVerb } of modes) {
      const rule: AlignRule = {
        id: "test.rule",
        mode: mode as any,
        guidance: "test",
      };

      const result = renderModeMarkers(rule, "hints");
      expect(result.prefix).toContain(expectedVerb);
    }
  });

  it("handles missing applies_to with default glob", () => {
    const rule: AlignRule = {
      id: "test.rule",
      mode: "always",
      guidance: "test",
    };

    const result = renderModeMarkers(rule, "hints");
    expect(result.prefix).toContain("`**/*`");
  });
});

describe("extractMarkerPairs", () => {
  it("parses valid marker pairs correctly", () => {
    const content = `
<!-- aligntrue:begin {"id":"rule1","mode":"intelligent"} -->
> Execution intent: apply intelligently when editing \`**/*.ts\`.

### Rule 1
Content here
<!-- aligntrue:end {"id":"rule1"} -->
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors).toHaveLength(0);
    expect(result.markers.size).toBe(1);
    expect(result.markers.get("rule1")).toMatchObject({
      id: "rule1",
      mode: "intelligent",
    });
  });

  it("detects missing end markers", () => {
    const content = `
<!-- aligntrue:begin {"id":"rule1"} -->
Content without end marker
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("without matching end");
  });

  it("detects duplicate begin markers", () => {
    const content = `
<!-- aligntrue:begin {"id":"rule1"} -->
First occurrence
<!-- aligntrue:begin {"id":"rule1"} -->
Second occurrence
<!-- aligntrue:end {"id":"rule1"} -->
    `;

    const result = extractMarkerPairs(content);

    const duplicateError = result.errors.find((e) =>
      e.message.includes("Duplicate"),
    );
    expect(duplicateError).toBeDefined();
  });

  it("detects end marker without begin", () => {
    const content = `
Some content
<!-- aligntrue:end {"id":"orphan"} -->
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("without matching begin");
  });

  it("detects invalid JSON with line numbers", () => {
    const content = `
Line 1
<!-- aligntrue:begin {invalid json} -->
Line 3
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Invalid JSON");
    expect(result.errors[0].line).toBe(3); // Template literal starts with newline, marker is on line 3
  });

  it("detects missing id in markers", () => {
    const content = `
<!-- aligntrue:begin {"mode":"intelligent"} -->
Content
<!-- aligntrue:end {"mode":"intelligent"} -->
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors.length).toBeGreaterThanOrEqual(2); // Both begin and end
    expect(result.errors.some((e) => e.message.includes("Missing id"))).toBe(
      true,
    );
  });

  it("handles multiple valid pairs", () => {
    const content = `
<!-- aligntrue:begin {"id":"rule1"} -->
Rule 1 content
<!-- aligntrue:end {"id":"rule1"} -->

<!-- aligntrue:begin {"id":"rule2","mode":"always"} -->
Rule 2 content
<!-- aligntrue:end {"id":"rule2"} -->
    `;

    const result = extractMarkerPairs(content);

    expect(result.errors).toHaveLength(0);
    expect(result.markers.size).toBe(2);
    expect(result.markers.get("rule1")).toBeDefined();
    expect(result.markers.get("rule2")).toBeDefined();
  });

  it("captures line numbers correctly", () => {
    const content = `Line 1
Line 2
Line 3
<!-- aligntrue:begin {"id":"rule1"} -->
Line 5`;

    const result = extractMarkerPairs(content);

    const marker = result.markers.get("rule1");
    expect(marker?.line).toBe(4);
  });

  it("extracts all marker fields", () => {
    const content = `
<!-- aligntrue:begin {"applies_to":["**/*.ts"],"id":"rule1","mode":"files","tags":["typescript"]} -->
Content
<!-- aligntrue:end {"id":"rule1"} -->
    `;

    const result = extractMarkerPairs(content);

    const marker = result.markers.get("rule1");
    expect(marker).toMatchObject({
      id: "rule1",
      mode: "files",
      applies_to: ["**/*.ts"],
      tags: ["typescript"],
    });
  });
});
