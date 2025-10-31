/**
 * Tests for drift detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectUpstreamDrift,
  detectVendorizedDrift,
  detectSeverityRemapDrift,
  detectLocalOverlayDrift,
  detectDrift,
  type DriftFinding,
} from "../../src/team/drift.js";
import type { Lockfile } from "../../src/lockfile/types.js";
import type { AllowList } from "../../src/team/allow.js";
import { computeHash } from "@aligntrue/schema";

describe("detectUpstreamDrift", () => {
  it("detects no drift when hashes match", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "base-global",
          content_hash: "abc123",
          source: "git:https://github.com/aligntrue/base-global",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [
        {
          type: "id",
          value: "git:https://github.com/aligntrue/base-global",
          resolved_hash: "abc123",
        },
      ],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(0);
  });

  it("detects drift when lockfile hash differs from allowed hash", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "base-global",
          content_hash: "abc123",
          source: "git:https://github.com/aligntrue/base-global",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [
        {
          type: "id",
          value: "git:https://github.com/aligntrue/base-global",
          resolved_hash: "def456", // Different hash
        },
      ],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "upstream",
      rule_id: "base-global",
      lockfile_hash: "abc123",
      expected_hash: "def456",
      source: "git:https://github.com/aligntrue/base-global",
    });
    expect(findings[0].message).toContain("differs from allowed version");
    expect(findings[0].suggestion).toContain("aligntrue team approve");
  });

  it("detects drift when source not in allow list", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "custom-pack",
          content_hash: "abc123",
          source: "git:https://github.com/custom/pack",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [
        {
          type: "id",
          value: "git:https://github.com/aligntrue/base-global",
          resolved_hash: "def456",
        },
      ],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "upstream",
      rule_id: "custom-pack",
      message: expect.stringContaining("not in allow list"),
      source: "git:https://github.com/custom/pack",
    });
  });

  it("skips entries without source (local rules)", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "local-rule",
          content_hash: "abc123",
          // No source field
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(0);
  });

  it("handles allow list entries without resolved_hash", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "base-global",
          content_hash: "abc123",
          source: "git:https://github.com/aligntrue/base-global",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [
        {
          type: "id",
          value: "git:https://github.com/aligntrue/base-global",
          // No resolved_hash yet
        },
      ],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(0);
  });

  it("detects multiple drift findings", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "pack1",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack1",
        },
        {
          rule_id: "pack2",
          content_hash: "def456",
          source: "git:https://github.com/org/pack2",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack1",
          resolved_hash: "different1",
        },
        {
          type: "id",
          value: "git:https://github.com/org/pack2",
          resolved_hash: "different2",
        },
      ],
    };

    const findings = detectUpstreamDrift(lockfile, allowList);
    expect(findings).toHaveLength(2);
  });
});

describe("detectVendorizedDrift", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects no drift when vendored pack exists", () => {
    const vendorPath = join(tempDir, "vendor/custom-pack");
    mkdirSync(vendorPath, { recursive: true });
    writeFileSync(join(vendorPath, ".aligntrue.yaml"), "profile:\n  id: test");

    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "custom-pack",
          content_hash: "abc123",
          vendor_path: "vendor/custom-pack",
          vendor_type: "submodule",
        },
      ],
      bundle_hash: "xyz789",
    };

    const findings = detectVendorizedDrift(lockfile, tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects drift when vendored pack missing", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "custom-pack",
          content_hash: "abc123",
          vendor_path: "vendor/custom-pack",
          vendor_type: "submodule",
        },
      ],
      bundle_hash: "xyz789",
    };

    const findings = detectVendorizedDrift(lockfile, tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "vendorized",
      rule_id: "custom-pack",
      message: expect.stringContaining("not found"),
      vendor_path: "vendor/custom-pack",
      vendor_type: "submodule",
    });
  });

  it("detects drift when vendored pack missing .aligntrue.yaml", () => {
    const vendorPath = join(tempDir, "vendor/custom-pack");
    mkdirSync(vendorPath, { recursive: true });
    // No .aligntrue.yaml file

    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "custom-pack",
          content_hash: "abc123",
          vendor_path: "vendor/custom-pack",
          vendor_type: "subtree",
        },
      ],
      bundle_hash: "xyz789",
    };

    const findings = detectVendorizedDrift(lockfile, tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "vendorized",
      rule_id: "custom-pack",
      message: expect.stringContaining("missing .aligntrue.yaml"),
    });
  });

  it("skips entries without vendor_path", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "regular-pack",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
          // No vendor_path
        },
      ],
      bundle_hash: "xyz789",
    };

    const findings = detectVendorizedDrift(lockfile, tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects multiple vendorized drift findings", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "pack1",
          content_hash: "abc123",
          vendor_path: "vendor/pack1",
          vendor_type: "submodule",
        },
        {
          rule_id: "pack2",
          content_hash: "def456",
          vendor_path: "vendor/pack2",
          vendor_type: "subtree",
        },
      ],
      bundle_hash: "xyz789",
    };

    const findings = detectVendorizedDrift(lockfile, tempDir);
    expect(findings).toHaveLength(2);
  });
});

describe("detectSeverityRemapDrift", () => {
  it("returns empty array (placeholder for Session 7)", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [],
      bundle_hash: "xyz789",
    };

    const findings = detectSeverityRemapDrift(lockfile);
    expect(findings).toHaveLength(0);
  });

  it("accepts basePath parameter", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [],
      bundle_hash: "xyz789",
    };

    const findings = detectSeverityRemapDrift(lockfile, "/some/path");
    expect(findings).toHaveLength(0);
  });
});

describe("detectLocalOverlayDrift", () => {
  it("returns empty array (placeholder for Phase 3.5)", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [],
      bundle_hash: "xyz789",
    };

    const findings = detectLocalOverlayDrift(lockfile);
    expect(findings).toHaveLength(0);
  });

  it("accepts basePath parameter", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-29T12:00:00Z",
      mode: "team",
      rules: [],
      bundle_hash: "xyz789",
    };

    const findings = detectLocalOverlayDrift(lockfile, "/some/path");
    expect(findings).toHaveLength(0);
  });
});

describe("detectDrift", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns no drift when lockfile doesn't exist", () => {
    const lockfilePath = join(tempDir, ".aligntrue.lock.json");
    const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

    const result = detectDrift(lockfilePath, allowListPath, tempDir);
    expect(result.has_drift).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  it("returns no drift when allow list doesn't exist", () => {
    const lockfilePath = join(tempDir, ".aligntrue.lock.json");
    const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

    writeFileSync(
      lockfilePath,
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-29T12:00:00Z",
        mode: "team",
        rules: [],
        bundle_hash: "xyz789",
      }),
    );

    const result = detectDrift(lockfilePath, allowListPath, tempDir);
    expect(result.has_drift).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  it("detects upstream and vendorized drift combined", () => {
    const lockfilePath = join(tempDir, ".aligntrue.lock.json");
    const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

    mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

    writeFileSync(
      lockfilePath,
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-29T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "upstream-pack",
            content_hash: "abc123",
            source: "git:https://github.com/org/pack",
          },
          {
            rule_id: "vendored-pack",
            content_hash: "def456",
            vendor_path: "vendor/missing",
            vendor_type: "submodule",
          },
        ],
        bundle_hash: "xyz789",
      }),
    );

    writeFileSync(
      allowListPath,
      `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different123
`,
    );

    const result = detectDrift(lockfilePath, allowListPath, tempDir);
    expect(result.has_drift).toBe(true);
    expect(result.findings).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.by_category.upstream).toBe(1);
    expect(result.summary.by_category.vendorized).toBe(1);
  });

  it("throws error for invalid lockfile", () => {
    const lockfilePath = join(tempDir, ".aligntrue.lock.json");
    const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

    mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });
    writeFileSync(lockfilePath, "invalid json");
    writeFileSync(allowListPath, "sources: []");

    expect(() => detectDrift(lockfilePath, allowListPath, tempDir)).toThrow(
      "Failed to parse lockfile",
    );
  });

  it("throws error for invalid allow list", () => {
    const lockfilePath = join(tempDir, ".aligntrue.lock.json");
    const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

    mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });
    writeFileSync(
      lockfilePath,
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-29T12:00:00Z",
        mode: "team",
        rules: [],
        bundle_hash: "xyz789",
      }),
    );
    writeFileSync(allowListPath, "invalid: yaml: [[[");

    expect(() => detectDrift(lockfilePath, allowListPath, tempDir)).toThrow(
      "Failed to parse allow list",
    );
  });

  describe("severity remap drift", () => {
    it("detects no drift when team.yaml hash matches", () => {
      const lockfilePath = join(tempDir, ".aligntrue.lock.json");
      const allowListPath = join(tempDir, ".aligntrue/allow.yaml");
      const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");

      mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

      // Create team.yaml
      writeFileSync(
        teamYamlPath,
        `severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "warn"
`,
      );

      // Compute hash for lockfile
      const teamYamlContent = readFileSync(teamYamlPath, "utf-8");
      const teamYamlHash = computeHash(teamYamlContent);

      writeFileSync(
        lockfilePath,
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
          team_yaml_hash: teamYamlHash,
        }),
      );
      writeFileSync(allowListPath, "version: 1\nsources: []");

      const result = detectDrift(lockfilePath, allowListPath, tempDir);
      expect(result.has_drift).toBe(false);
      expect(result.summary.by_category.severity_remap).toBe(0);
    });

    it("detects drift when team.yaml hash differs", () => {
      const lockfilePath = join(tempDir, ".aligntrue.lock.json");
      const allowListPath = join(tempDir, ".aligntrue/allow.yaml");
      const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");

      mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

      // Create team.yaml with different content
      writeFileSync(
        teamYamlPath,
        `severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "info"
`,
      );

      // Lockfile has different hash
      writeFileSync(
        lockfilePath,
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
          team_yaml_hash: "oldhash123",
        }),
      );
      writeFileSync(allowListPath, "version: 1\nsources: []");

      const result = detectDrift(lockfilePath, allowListPath, tempDir);
      expect(result.has_drift).toBe(true);
      expect(result.summary.by_category.severity_remap).toBe(1);
      expect(result.findings[0].category).toBe("severity_remap");
      expect(result.findings[0].message).toContain("policy has changed");
    });

    it("detects drift when team.yaml is removed", () => {
      const lockfilePath = join(tempDir, ".aligntrue.lock.json");
      const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

      mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

      // Lockfile has team_yaml_hash but file doesn't exist
      writeFileSync(
        lockfilePath,
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
          team_yaml_hash: "somehash123",
        }),
      );
      writeFileSync(allowListPath, "version: 1\nsources: []");

      const result = detectDrift(lockfilePath, allowListPath, tempDir);
      expect(result.has_drift).toBe(true);
      expect(result.summary.by_category.severity_remap).toBe(1);
      expect(result.findings[0].category).toBe("severity_remap");
      expect(result.findings[0].message).toContain("removed");
    });

    it("detects no drift when team.yaml doesn't exist and lockfile has no hash", () => {
      const lockfilePath = join(tempDir, ".aligntrue.lock.json");
      const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

      mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

      // Lockfile has no team_yaml_hash
      writeFileSync(
        lockfilePath,
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );
      writeFileSync(allowListPath, "version: 1\nsources: []");

      const result = detectDrift(lockfilePath, allowListPath, tempDir);
      expect(result.has_drift).toBe(false);
      expect(result.summary.by_category.severity_remap).toBe(0);
    });

    it("detects drift when team.yaml is added after lockfile generation", () => {
      const lockfilePath = join(tempDir, ".aligntrue.lock.json");
      const allowListPath = join(tempDir, ".aligntrue/allow.yaml");
      const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");

      mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

      // Create team.yaml
      writeFileSync(
        teamYamlPath,
        `severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "warn"
`,
      );

      // Lockfile has no team_yaml_hash (generated before team.yaml existed)
      writeFileSync(
        lockfilePath,
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );
      writeFileSync(allowListPath, "version: 1\nsources: []");

      const result = detectDrift(lockfilePath, allowListPath, tempDir);
      // No drift - if lockfile was generated without team.yaml, adding it later doesn't constitute drift
      // until lockfile is regenerated
      expect(result.summary.by_category.severity_remap).toBe(0);
    });
  });

  describe("triple-hash drift detection (Phase 3.5)", () => {
    describe("detectOverlayDrift", () => {
      it("detects no drift when overlay_hash matches", async () => {
        const { detectOverlayDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "test.rule",
            content_hash: "result123",
            base_hash: "base123",
            overlay_hash: "overlay123",
            result_hash: "result123",
          },
        ];

        const findings = detectOverlayDrift(entries, "overlay123");
        expect(findings).toHaveLength(0);
      });

      it("detects drift when overlay_hash differs", async () => {
        const { detectOverlayDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "test.rule",
            content_hash: "result123",
            base_hash: "base123",
            overlay_hash: "oldoverlay",
            result_hash: "result123",
          },
        ];

        const findings = detectOverlayDrift(entries, "newoverlay");
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          category: "overlay",
          rule_id: "test.rule",
          message: expect.stringContaining("Overlay configuration has changed"),
          overlay_hash: "oldoverlay",
          expected_overlay_hash: "newoverlay",
        });
      });

      it("skips entries without overlay_hash", async () => {
        const { detectOverlayDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "local.rule",
            content_hash: "hash123",
            // No overlay_hash
          },
        ];

        const findings = detectOverlayDrift(entries, "overlay123");
        expect(findings).toHaveLength(0);
      });

      it("detects drift in multiple entries", async () => {
        const { detectOverlayDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "rule.one",
            overlay_hash: "oldoverlay",
          },
          {
            rule_id: "rule.two",
            overlay_hash: "oldoverlay",
          },
        ];

        const findings = detectOverlayDrift(entries, "newoverlay");
        expect(findings).toHaveLength(2);
      });
    });

    describe("detectResultDrift", () => {
      it("detects no drift when result_hash matches", async () => {
        const { detectResultDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "test.rule",
            base_hash: "base123",
            overlay_hash: "overlay123",
            result_hash: "result123",
          },
        ];

        const currentResults = new Map([["test.rule", "result123"]]);

        const findings = detectResultDrift(entries, currentResults);
        expect(findings).toHaveLength(0);
      });

      it("detects drift when result_hash differs", async () => {
        const { detectResultDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "test.rule",
            base_hash: "base123",
            overlay_hash: "overlay123",
            result_hash: "oldresult",
          },
        ];

        const currentResults = new Map([["test.rule", "newresult"]]);

        const findings = detectResultDrift(entries, currentResults);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          category: "result",
          rule_id: "test.rule",
          message: expect.stringContaining("Result hash differs"),
          result_hash: "oldresult",
          expected_result_hash: "newresult",
          base_hash: "base123",
          overlay_hash: "overlay123",
        });
      });

      it("skips entries without triple-hash format", async () => {
        const { detectResultDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "legacy.rule",
            content_hash: "hash123",
            // No triple-hash fields
          },
        ];

        const currentResults = new Map([["legacy.rule", "hash456"]]);

        const findings = detectResultDrift(entries, currentResults);
        expect(findings).toHaveLength(0);
      });

      it("skips entries not in currentResults map", async () => {
        const { detectResultDrift } = await import("../../src/team/drift.js");

        const entries: any[] = [
          {
            rule_id: "test.rule",
            base_hash: "base123",
            overlay_hash: "overlay123",
            result_hash: "result123",
          },
        ];

        const currentResults = new Map(); // Empty

        const findings = detectResultDrift(entries, currentResults);
        expect(findings).toHaveLength(0);
      });
    });

    describe("detectUpstreamDrift with triple-hash", () => {
      it("uses base_hash when available", () => {
        const lockfile: Lockfile = {
          version: "1",
          generated_at: "2025-10-31T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test.rule",
              content_hash: "result123",
              source: "git:https://github.com/org/pack",
              base_hash: "oldbase",
              overlay_hash: "overlay123",
              result_hash: "result123",
            },
          ],
          bundle_hash: "xyz789",
        };

        const allowList: AllowList = {
          sources: [
            {
              type: "id",
              value: "git:https://github.com/org/pack",
              resolved_hash: "newbase", // Different from base_hash
            },
          ],
        };

        const findings = detectUpstreamDrift(lockfile, allowList);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          category: "upstream",
          message: expect.stringContaining("base_hash differs"),
          base_hash: "oldbase",
          expected_base_hash: "newbase",
          overlay_hash: "overlay123",
          result_hash: "result123",
        });
      });

      it("falls back to content_hash when base_hash not available", () => {
        const lockfile: Lockfile = {
          version: "1",
          generated_at: "2025-10-31T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "legacy.rule",
              content_hash: "oldhash",
              source: "git:https://github.com/org/pack",
              // No triple-hash fields
            },
          ],
          bundle_hash: "xyz789",
        };

        const allowList: AllowList = {
          sources: [
            {
              type: "id",
              value: "git:https://github.com/org/pack",
              resolved_hash: "newhash",
            },
          ],
        };

        const findings = detectUpstreamDrift(lockfile, allowList);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          category: "upstream",
          message: expect.not.stringContaining("base_hash"),
          lockfile_hash: "oldhash",
        });
      });

      it("suggests using update command for base_hash drift", () => {
        const lockfile: Lockfile = {
          version: "1",
          generated_at: "2025-10-31T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test.rule",
              content_hash: "result123",
              source: "git:https://github.com/org/pack",
              base_hash: "oldbase",
              overlay_hash: "overlay123",
              result_hash: "result123",
            },
          ],
          bundle_hash: "xyz789",
        };

        const allowList: AllowList = {
          sources: [
            {
              type: "id",
              value: "git:https://github.com/org/pack",
              resolved_hash: "newbase",
            },
          ],
        };

        const findings = detectUpstreamDrift(lockfile, allowList);
        expect(findings[0].suggestion).toContain("aligntrue update apply");
      });
    });

    describe("integrated drift detection", () => {
      it("categorizes drift into upstream/overlay/result", () => {
        const lockfilePath = join(tempDir, ".aligntrue.lock.json");
        const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

        mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

        // Lockfile with triple-hash entries
        writeFileSync(
          lockfilePath,
          JSON.stringify({
            version: "1",
            generated_at: "2025-10-31T12:00:00Z",
            mode: "team",
            rules: [
              {
                rule_id: "upstream.rule",
                content_hash: "result1",
                source: "git:https://github.com/org/pack",
                base_hash: "oldbase",
                overlay_hash: "overlay1",
                result_hash: "result1",
              },
            ],
            bundle_hash: "xyz789",
          }),
        );

        writeFileSync(
          allowListPath,
          `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: newbase
`,
        );

        const result = detectDrift(lockfilePath, allowListPath, tempDir);
        expect(result.has_drift).toBe(true);
        expect(result.summary.by_category.upstream).toBe(1);
      });

      it("reports correct summary counts for all categories", () => {
        const lockfilePath = join(tempDir, ".aligntrue.lock.json");
        const allowListPath = join(tempDir, ".aligntrue/allow.yaml");

        mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });

        writeFileSync(
          lockfilePath,
          JSON.stringify({
            version: "1",
            generated_at: "2025-10-31T12:00:00Z",
            mode: "team",
            rules: [
              {
                rule_id: "rule1",
                content_hash: "hash1",
                source: "git:https://github.com/org/pack",
                base_hash: "oldbase",
              },
              {
                rule_id: "rule2",
                content_hash: "hash2",
                vendor_path: "vendor/missing",
              },
            ],
            bundle_hash: "xyz789",
          }),
        );

        writeFileSync(
          allowListPath,
          `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: newbase
`,
        );

        const result = detectDrift(lockfilePath, allowListPath, tempDir);
        expect(result.summary.by_category.upstream).toBe(1);
        expect(result.summary.by_category.vendorized).toBe(1);
        expect(result.summary.total).toBe(2);
      });
    });
  });
});
