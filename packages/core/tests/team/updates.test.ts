/**
 * Tests for update detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectUpstreamUpdates,
  generateUpdateSummary,
  detectUpdatesForConfig,
  type UpdateFinding,
} from "../../src/team/updates.js";
import type { Lockfile } from "../../src/lockfile/types.js";
import type { AllowList } from "../../src/team/types.js";

describe("detectUpstreamUpdates", () => {
  it("detects updates when allowed hash differs from lockfile hash", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "base-global",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack",
          resolved_hash: "def456", // Different from lockfile
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(1);
    expect(updates[0].source).toBe("git:https://github.com/org/pack");
    expect(updates[0].current_sha).toBe("abc123");
    expect(updates[0].latest_sha).toBe("def456");
    expect(updates[0].affected_rules).toContain("base-global");
    expect(updates[0].breaking_change).toBe(false);
  });

  it("returns empty array when no updates available", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "base-global",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack",
          resolved_hash: "abc123", // Same as lockfile
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(0);
  });

  it("groups multiple rules from same source", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "rule-1",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
        },
        {
          rule_id: "rule-2",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack",
          resolved_hash: "def456",
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(1);
    expect(updates[0].affected_rules).toHaveLength(2);
    expect(updates[0].affected_rules).toContain("rule-1");
    expect(updates[0].affected_rules).toContain("rule-2");
  });

  it("handles multiple sources with updates", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "rule-1",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack1",
        },
        {
          rule_id: "rule-2",
          content_hash: "xyz789",
          source: "git:https://github.com/org/pack2",
        },
      ],
      bundle_hash: "bundle123",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack1",
          resolved_hash: "new123",
        },
        {
          type: "id",
          value: "git:https://github.com/org/pack2",
          resolved_hash: "new789",
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(2);
    expect(updates.find((u) => u.source.includes("pack1"))).toBeDefined();
    expect(updates.find((u) => u.source.includes("pack2"))).toBeDefined();
  });

  it("ignores entries without source (local rules)", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
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
      version: 1,
      sources: [],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(0);
  });

  it("skips sources not in allow list", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "rule-1",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack1",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack2", // Different source
          resolved_hash: "def456",
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(0);
  });

  it("skips sources without resolved_hash", () => {
    const lockfile: Lockfile = {
      version: "1",
      generated_at: "2025-10-30T12:00:00Z",
      mode: "team",
      rules: [
        {
          rule_id: "rule-1",
          content_hash: "abc123",
          source: "git:https://github.com/org/pack",
        },
      ],
      bundle_hash: "xyz789",
    };

    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "git:https://github.com/org/pack",
          // No resolved_hash
        },
      ],
    };

    const updates = detectUpstreamUpdates(lockfile, allowList);

    expect(updates).toHaveLength(0);
  });

  describe("triple-hash overlay support (Overlays system)", () => {
    it("uses base_hash when available for update detection", () => {
      const lockfile: Lockfile = {
        version: "1",
        generated_at: "2025-10-31T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "test.rule",
            content_hash: "result456", // Result after overlays
            source: "git:https://github.com/org/pack",
            base_hash: "base123", // Base upstream hash
            overlay_hash: "overlay789",
            result_hash: "result456",
          },
        ],
        bundle_hash: "xyz789",
      };

      const allowList: AllowList = {
        version: 1,
        sources: [
          {
            type: "id",
            value: "git:https://github.com/org/pack",
            resolved_hash: "base999", // New base upstream
          },
        ],
      };

      const updates = detectUpstreamUpdates(lockfile, allowList);

      expect(updates).toHaveLength(1);
      expect(updates[0].current_sha).toBe("base123"); // Uses base_hash
      expect(updates[0].latest_sha).toBe("base999");
    });

    it("falls back to content_hash when base_hash not available", () => {
      const lockfile: Lockfile = {
        version: "1",
        generated_at: "2025-10-31T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "legacy.rule",
            content_hash: "content123",
            source: "git:https://github.com/org/pack",
            // No triple-hash fields
          },
        ],
        bundle_hash: "xyz789",
      };

      const allowList: AllowList = {
        version: 1,
        sources: [
          {
            type: "id",
            value: "git:https://github.com/org/pack",
            resolved_hash: "content999",
          },
        ],
      };

      const updates = detectUpstreamUpdates(lockfile, allowList);

      expect(updates).toHaveLength(1);
      expect(updates[0].current_sha).toBe("content123"); // Uses content_hash
    });

    it("no update when base_hash matches (overlay changes don't trigger update)", () => {
      const lockfile: Lockfile = {
        version: "1",
        generated_at: "2025-10-31T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "test.rule",
            content_hash: "result456",
            source: "git:https://github.com/org/pack",
            base_hash: "base123",
            overlay_hash: "oldoverlay",
            result_hash: "result456",
          },
        ],
        bundle_hash: "xyz789",
      };

      const allowList: AllowList = {
        version: 1,
        sources: [
          {
            type: "id",
            value: "git:https://github.com/org/pack",
            resolved_hash: "base123", // Same base
          },
        ],
      };

      const updates = detectUpstreamUpdates(lockfile, allowList);

      // No update because base_hash matches
      // (overlay changes are detected separately by drift detection)
      expect(updates).toHaveLength(0);
    });
  });
});

describe("generateUpdateSummary", () => {
  it("generates summary for single update", () => {
    const updates: UpdateFinding[] = [
      {
        source: "git:https://github.com/org/pack",
        current_sha: "abc123",
        latest_sha: "def456",
        affected_rules: ["rule-1", "rule-2"],
        breaking_change: false,
      },
    ];

    const summary = generateUpdateSummary(updates);

    expect(summary).toContain("1 source updated");
    expect(summary).toContain("2 rules affected");
    expect(summary).not.toContain("breaking");
  });

  it("generates summary for multiple updates", () => {
    const updates: UpdateFinding[] = [
      {
        source: "git:https://github.com/org/pack1",
        current_sha: "abc123",
        latest_sha: "def456",
        affected_rules: ["rule-1"],
        breaking_change: false,
      },
      {
        source: "git:https://github.com/org/pack2",
        current_sha: "xyz789",
        latest_sha: "new789",
        affected_rules: ["rule-2", "rule-3"],
        breaking_change: false,
      },
    ];

    const summary = generateUpdateSummary(updates);

    expect(summary).toContain("2 sources updated");
    expect(summary).toContain("3 rules affected");
  });

  it("includes breaking changes in summary", () => {
    const updates: UpdateFinding[] = [
      {
        source: "git:https://github.com/org/pack",
        current_sha: "abc123",
        latest_sha: "def456",
        affected_rules: ["rule-1"],
        breaking_change: true,
      },
    ];

    const summary = generateUpdateSummary(updates);

    expect(summary).toContain("1 breaking change");
  });

  it("returns no updates message when empty", () => {
    const summary = generateUpdateSummary([]);

    expect(summary).toBe("No updates available");
  });
});

describe("detectUpdatesForConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "updates-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects updates from config paths", async () => {
    // Write lockfile
    writeFileSync(
      join(tempDir, ".aligntrue.lock.json"),
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-30T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "base-global",
            content_hash: "abc123",
            source: "git:https://github.com/org/pack",
          },
        ],
        bundle_hash: "xyz789",
      }),
    );

    // Write allow list
    mkdirSync(join(tempDir, ".aligntrue"));
    writeFileSync(
      join(tempDir, ".aligntrue/allow.yaml"),
      `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: def456
`,
    );

    const result = await detectUpdatesForConfig({
      rootDir: tempDir,
      lockfilePath: join(tempDir, ".aligntrue.lock.json"),
      allowListPath: join(tempDir, ".aligntrue/allow.yaml"),
    });

    expect(result.has_updates).toBe(true);
    expect(result.updates).toHaveLength(1);
    expect(result.summary.total).toBe(1);
    expect(result.summary.sources_updated).toBe(1);
    expect(result.summary.rules_affected).toBe(1);
  });

  it("returns empty result when no updates", async () => {
    // Write lockfile
    writeFileSync(
      join(tempDir, ".aligntrue.lock.json"),
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-30T12:00:00Z",
        mode: "team",
        rules: [
          {
            rule_id: "base-global",
            content_hash: "abc123",
            source: "git:https://github.com/org/pack",
          },
        ],
        bundle_hash: "xyz789",
      }),
    );

    // Write allow list (same hash)
    mkdirSync(join(tempDir, ".aligntrue"));
    writeFileSync(
      join(tempDir, ".aligntrue/allow.yaml"),
      `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: abc123
`,
    );

    const result = await detectUpdatesForConfig({
      rootDir: tempDir,
      lockfilePath: join(tempDir, ".aligntrue.lock.json"),
      allowListPath: join(tempDir, ".aligntrue/allow.yaml"),
    });

    expect(result.has_updates).toBe(false);
    expect(result.updates).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("returns empty result when lockfile missing", async () => {
    mkdirSync(join(tempDir, ".aligntrue"));
    writeFileSync(
      join(tempDir, ".aligntrue/allow.yaml"),
      `version: 1
sources: []
`,
    );

    const result = await detectUpdatesForConfig({
      rootDir: tempDir,
      lockfilePath: join(tempDir, ".aligntrue.lock.json"),
      allowListPath: join(tempDir, ".aligntrue/allow.yaml"),
    });

    expect(result.has_updates).toBe(false);
    expect(result.updates).toHaveLength(0);
  });

  it("returns empty result when allow list missing", async () => {
    writeFileSync(
      join(tempDir, ".aligntrue.lock.json"),
      JSON.stringify({
        version: "1",
        generated_at: "2025-10-30T12:00:00Z",
        mode: "team",
        rules: [],
        bundle_hash: "xyz789",
      }),
    );

    const result = await detectUpdatesForConfig({
      rootDir: tempDir,
      lockfilePath: join(tempDir, ".aligntrue.lock.json"),
      allowListPath: join(tempDir, ".aligntrue/allow.yaml"),
    });

    expect(result.has_updates).toBe(false);
    expect(result.updates).toHaveLength(0);
  });
});
