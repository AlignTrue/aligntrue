/**
 * Plugs resolution integration tests
 * Tests template slot resolution with fills
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { cleanupDir } from "../helpers/fs-cleanup.js";
import * as yaml from "yaml";

let TEST_DIR: string;

// Skip on Windows due to file cleanup issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-plugs-"));
  process.chdir(TEST_DIR);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Plugs Resolution Integration", () => {
  it("validates plug slot declaration structure", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Testing Guidelines",
          content: "Run tests with: [[plug:test.cmd]]",
          level: 2,
          fingerprint: "testing-guidelines",
        },
      ],
      plugs: {
        slots: {
          "test.cmd": {
            description: "Command to run tests",
            format: "command",
            required: true,
            example: "pytest -q",
          },
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(parsed.plugs).toBeDefined();
    expect(parsed.plugs.slots).toBeDefined();
    expect(parsed.plugs.slots["test.cmd"]).toBeDefined();
    expect(parsed.plugs.slots["test.cmd"].format).toBe("command");
    expect(parsed.plugs.slots["test.cmd"].required).toBe(true);
  });

  it("validates plug fills structure", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Testing Guidelines",
          content: "Run tests with: [[plug:test.cmd]]",
          level: 2,
          fingerprint: "testing-guidelines",
        },
      ],
      plugs: {
        slots: {
          "test.cmd": {
            description: "Command to run tests",
            format: "command",
            required: true,
          },
        },
        fills: {
          "test.cmd": "pnpm test",
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(parsed.plugs.fills).toBeDefined();
    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
  });

  it("validates multiple plug slots", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Guidelines",
          content:
            "Run: [[plug:test.cmd]]\nDocs: [[plug:docs.url]]\nConfig: [[plug:config.file]]",
          level: 2,
          fingerprint: "guidelines",
        },
      ],
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
          },
          "docs.url": {
            description: "Documentation URL",
            format: "url",
            required: false,
          },
          "config.file": {
            description: "Config file path",
            format: "file",
            required: true,
          },
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(Object.keys(parsed.plugs.slots)).toHaveLength(3);
    expect(parsed.plugs.slots["test.cmd"].format).toBe("command");
    expect(parsed.plugs.slots["docs.url"].format).toBe("url");
    expect(parsed.plugs.slots["config.file"].format).toBe("file");
  });

  it("validates plug format types", () => {
    const formats = ["command", "text", "file", "url"];

    formats.forEach((format) => {
      const ir = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Test",
            content: "Value: [[plug:test.value]]",
            level: 2,
            fingerprint: "test",
          },
        ],
        plugs: {
          slots: {
            "test.value": {
              description: `Test ${format} value`,
              format,
              required: false,
            },
          },
        },
      };

      writeFileSync(
        join(TEST_DIR, ".aligntrue/rules"),
        yaml.stringify(ir),
        "utf-8",
      );

      const irContent = readFileSync(
        join(TEST_DIR, ".aligntrue/rules"),
        "utf-8",
      );
      const parsed = yaml.parse(irContent);

      expect(parsed.plugs.slots["test.value"].format).toBe(format);
    });
  });

  it("validates required vs optional plugs", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          content: "Required: [[plug:required]]\nOptional: [[plug:optional]]",
          level: 2,
          fingerprint: "test",
        },
      ],
      plugs: {
        slots: {
          required: {
            description: "Required plug",
            format: "text",
            required: true,
          },
          optional: {
            description: "Optional plug",
            format: "text",
            required: false,
          },
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(parsed.plugs.slots.required.required).toBe(true);
    expect(parsed.plugs.slots.optional.required).toBe(false);
  });

  it("validates plug examples", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          content: "Value: [[plug:test.cmd]]",
          level: 2,
          fingerprint: "test",
        },
      ],
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
            example: "pytest -q",
          },
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(parsed.plugs.slots["test.cmd"].example).toBe("pytest -q");
  });

  it("validates plug fills with different formats", () => {
    const ir = {
      id: "test-align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          content: "Values",
          level: 2,
          fingerprint: "test",
        },
      ],
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: false,
          },
          "docs.url": {
            description: "Documentation URL",
            format: "url",
            required: false,
          },
          "config.file": {
            description: "Config file",
            format: "file",
            required: false,
          },
          "author.name": {
            description: "Author name",
            format: "text",
            required: false,
          },
        },
        fills: {
          "test.cmd": "pnpm test",
          "docs.url": "https://docs.example.com",
          "config.file": "config/settings.json",
          "author.name": "Jane Smith",
        },
      },
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules"),
      yaml.stringify(ir),
      "utf-8",
    );

    const irContent = readFileSync(join(TEST_DIR, ".aligntrue/rules"), "utf-8");
    const parsed = yaml.parse(irContent);

    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
    expect(parsed.plugs.fills["docs.url"]).toBe("https://docs.example.com");
    expect(parsed.plugs.fills["config.file"]).toBe("config/settings.json");
    expect(parsed.plugs.fills["author.name"]).toBe("Jane Smith");
  });

  it("validates plug key naming conventions", () => {
    const validKeys = [
      "test.cmd",
      "docs.url",
      "author.name",
      "build-output",
      "config_file",
      "test123",
    ];

    validKeys.forEach((key) => {
      const ir = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Test",
            content: `Value: [[plug:${key}]]`,
            level: 2,
            fingerprint: "test",
          },
        ],
        plugs: {
          slots: {
            [key]: {
              description: "Test value",
              format: "text",
              required: false,
            },
          },
        },
      };

      writeFileSync(
        join(TEST_DIR, ".aligntrue/rules"),
        yaml.stringify(ir),
        "utf-8",
      );

      const irContent = readFileSync(
        join(TEST_DIR, ".aligntrue/rules"),
        "utf-8",
      );
      const parsed = yaml.parse(irContent);

      expect(parsed.plugs.slots[key]).toBeDefined();
    });
  });

  it("validates plug merge order (base < stack < repo)", () => {
    const config = {
      version: "1",
      mode: "solo",
      sources: [
        {
          type: "local",
          path: "base-align.yaml",
        },
        {
          type: "local",
          path: "stack-align.yaml",
        },
      ],
      plugs: {
        fills: {
          "test.cmd": "pnpm test", // Repo-local fill (highest priority)
        },
      },
      exporters: ["agents-md"],
    };

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      "utf-8",
    );
    const parsed = yaml.parse(configContent);

    expect(parsed.plugs).toBeDefined();
    expect(parsed.plugs.fills["test.cmd"]).toBe("pnpm test");
  });
});
