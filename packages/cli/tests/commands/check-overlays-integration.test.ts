/**
 * Integration tests for check command with overlay validation (Phase 3.5, Session 5)
 * These tests verify end-to-end behavior with real file I/O
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { validateOverlays } from "@aligntrue/core";
import { parseYamlToJson } from "@aligntrue/schema";
import type {
  AlignPack,
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
    path: .aligntrue/.rules.yaml
overlays:
  overrides:
    - selector: 'rule[id="test-rule"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
spec_version: "1"
profile:
  id: test-pack
  name: Test Pack
  version: 1.0.0
rules:
  - id: test-rule
    description: Test rule
    severity: error
    enabled: true
    tags: []
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: AlignPack = parseYamlToJson(rules) as AlignPack;

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
    path: .aligntrue/.rules.yaml
overlays:
  overrides:
    - selector: 'rule[id="non-existent"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
spec_version: "1"
profile:
  id: test-pack
  name: Test Pack
  version: 1.0.0
rules:
  - id: test-rule
    description: Test rule
    severity: error
    enabled: true
    tags: []
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: AlignPack = parseYamlToJson(rules) as AlignPack;

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
    path: .aligntrue/.rules.yaml
overlays:
  overrides:
${overlays}
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
spec_version: "1"
profile:
  id: test-pack
  name: Test Pack
  version: 1.0.0
rules:
  - id: test-rule
    description: Test rule
    severity: error
    enabled: true
    tags: []
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: AlignPack = parseYamlToJson(rules) as AlignPack;

    // Validate overlays
    const overlaysArray: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlaysArray, rulesData);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.type === "size_limit")).toBe(true);
  });

  it("warns about plug conflicts without failing validation", () => {
    const config = `
mode: solo
sources:
  - type: local
    path: .aligntrue/.rules.yaml
overlays:
  overrides:
    - selector: 'rule[id="test-rule"]'
      set:
        severity: warning
`;
    writeFileSync(configPath, config, "utf8");

    const rules = `
spec_version: "1"
profile:
  id: test-pack
  name: Test Pack
  version: 1.0.0
rules:
  - id: test-rule
    description: Test rule with plugs
    severity: error
    enabled: true
    tags: []
    plugs:
      - slot: severity
        description: Severity level
`;
    writeFileSync(rulesPath, rules, "utf8");

    // Parse config and rules
    const configData: AlignTrueConfig = parseYamlToJson(
      config,
    ) as AlignTrueConfig;
    const rulesData: AlignPack = parseYamlToJson(rules) as AlignPack;

    // Validate overlays
    const overlays: OverlayDefinition[] = configData.overlays.overrides;
    const result = validateOverlays(overlays, rulesData);

    expect(result.valid).toBe(true); // Warnings don't fail validation
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]?.type).toBe("plug_conflict");
  });
});
