/**
 * Tests for overlay configuration schema validation (Phase 3.5)
 */

import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("overlay config schema validation", () => {
  let testDir: string;

  function setupTestConfig(config: any): string {
    testDir = join(tmpdir(), `aligntrue-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const configPath = join(testDir, ".aligntrue.yaml");
    const yaml = require("js-yaml");
    writeFileSync(configPath, yaml.dump(config));
    return configPath; // Return file path, not directory
  }

  function cleanupTestConfig() {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }

  it("accepts valid overlay configuration", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test-rule]",
            set: { severity: "warn" },
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays).toBeDefined();
      expect(loaded.overlays?.overrides).toHaveLength(1);
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts overlay with set operation", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test]",
            set: {
              severity: "error",
              "check.inputs.pattern": "^src/",
            },
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.overrides?.[0].set).toEqual({
        severity: "error",
        "check.inputs.pattern": "^src/",
      });
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts overlay with remove operation", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test]",
            remove: ["autofix", "tags"],
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.overrides?.[0].remove).toEqual([
        "autofix",
        "tags",
      ]);
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts overlay with both set and remove", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test]",
            set: { severity: "warn" },
            remove: ["autofix"],
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.overrides?.[0].set).toBeDefined();
      expect(loaded.overlays?.overrides?.[0].remove).toBeDefined();
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts custom limits", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [],
        limits: {
          max_overrides: 25,
          max_operations_per_override: 10,
        },
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.limits?.max_overrides).toBe(25);
      expect(loaded.overlays?.limits?.max_operations_per_override).toBe(10);
    } finally {
      cleanupTestConfig();
    }
  });

  it("rejects overlay without selector", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            set: { severity: "warn" },
          } as any,
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      await expect(() => loadConfig(configPath)).rejects.toThrow();
    } finally {
      cleanupTestConfig();
    }
  });

  it("rejects overlay with empty selector", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "",
            set: { severity: "warn" },
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      await expect(() => loadConfig(configPath)).rejects.toThrow();
    } finally {
      cleanupTestConfig();
    }
  });

  it("rejects invalid limits (below minimum)", async () => {
    const config = {
      mode: "solo",
      overlays: {
        limits: {
          max_overrides: 0, // Below minimum of 1
        },
      },
    };
    const configPath = setupTestConfig(config);
    try {
      await expect(() => loadConfig(configPath)).rejects.toThrow();
    } finally {
      cleanupTestConfig();
    }
  });

  it("rejects invalid limits (above maximum)", async () => {
    const config = {
      mode: "solo",
      overlays: {
        limits: {
          max_overrides: 300, // Above maximum of 200
        },
      },
    };
    const configPath = setupTestConfig(config);
    try {
      await expect(() => loadConfig(configPath)).rejects.toThrow();
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts empty overrides array", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.overrides).toEqual([]);
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts config without overlays section", async () => {
    const config = {
      mode: "solo",
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays).toBeUndefined();
    } finally {
      cleanupTestConfig();
    }
  });

  it("accepts multiple overlays", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=rule-one]",
            set: { severity: "warn" },
          },
          {
            selector: "rule[id=rule-two]",
            remove: ["autofix"],
          },
          {
            selector: "rule[id=rule-three]",
            set: { severity: "error" },
            remove: ["tags"],
          },
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      const loaded = await loadConfig(configPath);
      expect(loaded.overlays?.overrides).toHaveLength(3);
    } finally {
      cleanupTestConfig();
    }
  });

  it("rejects additional properties in overlay definition", async () => {
    const config = {
      mode: "solo",
      overlays: {
        overrides: [
          {
            selector: "rule[id=test]",
            set: { severity: "warn" },
            invalid_field: "not allowed",
          } as any,
        ],
      },
    };
    const configPath = setupTestConfig(config);
    try {
      await expect(() => loadConfig(configPath)).rejects.toThrow();
    } finally {
      cleanupTestConfig();
    }
  });
});
