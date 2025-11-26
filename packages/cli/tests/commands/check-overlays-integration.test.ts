/**
 * Integration tests for check command with overlay validation (Overlays system)
 * These tests verify end-to-end behavior with real file I/O
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { validateOverlays } from "@aligntrue/core";
import { parseYamlToJson } from "@aligntrue/schema";
import type {
  Align,
  OverlayDefinition,
  AlignTrueConfig,
} from "@aligntrue/core";

describe("check command overlay validation - integration", () => {
  const testDir = join(process.cwd(), "temp-test-overlay-integration");
  const configPath = join(testDir, ".aligntrue", "config.yaml");
  const rulesPath = join(testDir, ".aligntrue", "rules.yaml");

  beforeEach(() => {
    // Create test directory
    mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("validates overlays successfully with valid selector", () => {
    const config = `
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
overlays:
  overrides:
    - selector: 'rule[id="test-rule"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule
    level: 2
    content: Test rule description
    fingerprint: test-rule
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: Align = parseYamlToJson(rules) as Align;

    // Validate overlays
    const overlays: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlays, rulesData);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("detects stale selector", () => {
    const config = `
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
overlays:
  overrides:
    - selector: 'rule[id="non-existent"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule
    level: 2
    content: Test rule description
    fingerprint: test-rule
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: Align = parseYamlToJson(rules) as Align;

    // Validate overlays
    const overlays: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlays, rulesData);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.type).toBe("stale");
  });

  it("detects size limit violations", () => {
    // Create config with too many overlays
    const overlays = Array.from(
      { length: 51 },
      (_, i) =>
        `    - selector: 'rule[id="test-rule"]'\n      set:\n        key${i}: value${i}`,
    ).join("\n");

    const config = `
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
overlays:
  overrides:
${overlays}
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule
    level: 2
    content: Test rule description
    fingerprint: test-rule
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: Align = parseYamlToJson(rules) as Align;

    // Validate overlays
    const overlaysArray: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlaysArray, rulesData);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.type === "size_limit")).toBe(true);
  });

  it("validates overlays without warnings when no conflicts", () => {
    const config = `
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
overlays:
  overrides:
    - selector: 'rule[id="test-rule"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule
    level: 2
    content: Test rule description
    fingerprint: test-rule
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: Align = parseYamlToJson(rules) as Align;

    // Validate overlays
    const overlays: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlays, rulesData);

    expect(result.valid).toBe(true);
    // Sections don't have plugs, so no plug conflict warnings expected
    expect(result.warnings).toBeUndefined();
  });
});
