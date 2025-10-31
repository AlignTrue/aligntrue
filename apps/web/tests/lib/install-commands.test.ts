/**
 * Tests for install command generation (Phase 4, Session 5)
 */

import { describe, it, expect } from "vitest";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import {
  generateInstallCommands,
  formatCommandBlock,
  generateDownloadFilename,
  findExporterPreview,
} from "../../lib/install-commands";

/**
 * Create minimal pack for testing
 */
function createTestPack(
  overrides: Partial<CatalogEntryExtended> = {},
): CatalogEntryExtended {
  return {
    id: "packs/base/test-pack",
    version: "1.0.0",
    name: "Test Pack",
    slug: "test-pack",
    description: "A test pack",
    summary_bullets: ["Feature 1", "Feature 2"],
    categories: ["testing"],
    compatible_tools: ["cursor"],
    license: "CC0-1.0",
    maintainer: {
      name: "Test Author",
      github: "testauthor",
    },
    last_updated: "2025-10-31T00:00:00Z",
    stats: {
      copies_7d: 0,
    },
    has_plugs: false,
    overlay_friendly: false,
    required_plugs_count: 0,
    exporters: [],
    ...overrides,
  };
}

describe("generateInstallCommands", () => {
  it("generates CLI and pack add commands for pack without plugs", () => {
    const pack = createTestPack();
    const commands = generateInstallCommands(pack);

    expect(commands).toHaveLength(2);
    expect(commands[0].label).toBe("Install AlignTrue CLI");
    expect(commands[0].command).toContain("curl -fsSL");
    expect(commands[0].required).toBe(false);

    expect(commands[1].label).toBe("Add pack");
    expect(commands[1].command).toBe(
      "aligntrue add catalog:packs/base/test-pack@1.0.0 --from=catalog_web",
    );
    expect(commands[1].required).toBe(true);
  });

  it("includes tracking flag in pack add command", () => {
    const pack = createTestPack();
    const commands = generateInstallCommands(pack);

    const packCommand = commands.find((c) => c.label === "Add pack");
    expect(packCommand?.command).toContain("--from=catalog_web");
  });

  it("generates plug set commands for required plugs", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 2,
      required_plugs: [
        {
          key: "test.cmd",
          description: "Test command to run",
          type: "command",
          default: "pnpm test",
        },
        {
          key: "coverage.threshold",
          description: "Minimum coverage percentage",
          type: "text",
          // No default
        },
      ],
    });

    const commands = generateInstallCommands(pack);

    expect(commands).toHaveLength(4); // CLI + pack + 2 plugs
    expect(commands[2].label).toBe("Configure test.cmd");
    expect(commands[2].command).toBe('aln plugs set test.cmd "pnpm test"');
    expect(commands[2].required).toBe(true);
    expect(commands[2].help).toBe("Test command to run");

    expect(commands[3].label).toBe("Configure coverage.threshold");
    expect(commands[3].command).toBe(
      'aln plugs set coverage.threshold "<coverage.threshold>"',
    );
    expect(commands[3].required).toBe(true);
  });

  it("uses plug default value when present", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 1,
      required_plugs: [
        {
          key: "test.cmd",
          description: "Test command",
          type: "command",
          default: "pnpm test",
        },
      ],
    });

    const commands = generateInstallCommands(pack);
    const plugCommand = commands.find((c) => c.label === "Configure test.cmd");

    expect(plugCommand?.command).toContain('"pnpm test"');
  });

  it("uses key placeholder when no default value", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 1,
      required_plugs: [
        {
          key: "api.key",
          description: "API key",
          type: "text",
        },
      ],
    });

    const commands = generateInstallCommands(pack);
    const plugCommand = commands.find((c) => c.label === "Configure api.key");

    expect(plugCommand?.command).toContain('"<api.key>"');
  });

  it("skips plug commands when no required plugs", () => {
    const pack = createTestPack({
      has_plugs: true,
      required_plugs_count: 0,
      required_plugs: [],
    });

    const commands = generateInstallCommands(pack);

    expect(commands).toHaveLength(2); // Only CLI + pack
  });

  it("handles missing required_plugs array", () => {
    const pack = createTestPack({
      has_plugs: false,
      required_plugs_count: 0,
      // required_plugs is undefined
    });

    const commands = generateInstallCommands(pack);

    expect(commands).toHaveLength(2); // Only CLI + pack
  });
});

describe("formatCommandBlock", () => {
  it("formats commands as copy-pasteable block", () => {
    const commands = [
      {
        label: "Install CLI",
        command: "curl -fsSL https://aligntrue.ai/install.sh | bash",
        required: false,
        help: "Skip if already installed",
      },
      {
        label: "Add pack",
        command: "aligntrue add catalog:pack@1.0.0 --from=catalog_web",
        required: true,
      },
    ];

    const block = formatCommandBlock(commands);

    expect(block).toContain("# Install CLI");
    expect(block).toContain("# Skip if already installed");
    expect(block).toContain("curl -fsSL");
    expect(block).toContain("# Add pack");
    expect(block).toContain("aligntrue add");
    expect(block).toContain("\n\n"); // Double newline between commands
  });

  it("omits help text when not provided", () => {
    const commands = [
      {
        label: "Add pack",
        command: "aligntrue add catalog:pack@1.0.0",
        required: true,
      },
    ];

    const block = formatCommandBlock(commands);

    expect(block).toBe("# Add pack\naligntrue add catalog:pack@1.0.0");
  });

  it("handles empty command array", () => {
    const block = formatCommandBlock([]);
    expect(block).toBe("");
  });
});

describe("generateDownloadFilename", () => {
  it("generates filename from pack ID and version", () => {
    const pack = createTestPack({
      id: "packs/base/base-global",
      version: "1.0.0",
    });

    const filename = generateDownloadFilename(pack);

    expect(filename).toBe("base-global-v1.0.0.yaml");
  });

  it("extracts last segment of pack ID", () => {
    const pack = createTestPack({
      id: "org/namespace/my-pack",
      version: "2.3.4",
    });

    const filename = generateDownloadFilename(pack);

    expect(filename).toBe("my-pack-v2.3.4.yaml");
  });

  it("handles simple pack IDs", () => {
    const pack = createTestPack({
      id: "simple-pack",
      version: "1.0.0",
    });

    const filename = generateDownloadFilename(pack);

    expect(filename).toBe("simple-pack-v1.0.0.yaml");
  });

  it("handles empty ID gracefully", () => {
    const pack = createTestPack({
      id: "",
      version: "1.0.0",
    });

    const filename = generateDownloadFilename(pack);

    expect(filename).toBe("pack-v1.0.0.yaml");
  });
});

describe("findExporterPreview", () => {
  it("finds exporter preview by format", () => {
    const pack = createTestPack({
      exporters: [
        {
          format: "yaml",
          preview: 'spec_version: "1"',
          preview_meta: {
            engine_version: "0.1.0",
            canonical_yaml_sha: "abc123",
            rendered_at: "2025-10-31T00:00:00Z",
          },
        },
        {
          format: "cursor",
          preview: "# Cursor rules",
          preview_meta: {
            engine_version: "0.1.0",
            canonical_yaml_sha: "abc123",
            rendered_at: "2025-10-31T00:00:00Z",
          },
        },
      ],
    });

    const yamlPreview = findExporterPreview(pack, "yaml");
    expect(yamlPreview).toBe('spec_version: "1"');

    const cursorPreview = findExporterPreview(pack, "cursor");
    expect(cursorPreview).toBe("# Cursor rules");
  });

  it("returns null when format not found", () => {
    const pack = createTestPack({
      exporters: [
        {
          format: "yaml",
          preview: "content",
          preview_meta: {
            engine_version: "0.1.0",
            canonical_yaml_sha: "abc123",
            rendered_at: "2025-10-31T00:00:00Z",
          },
        },
      ],
    });

    const preview = findExporterPreview(pack, "nonexistent");
    expect(preview).toBeNull();
  });

  it("returns null when exporters array is empty", () => {
    const pack = createTestPack({
      exporters: [],
    });

    const preview = findExporterPreview(pack, "yaml");
    expect(preview).toBeNull();
  });
});
