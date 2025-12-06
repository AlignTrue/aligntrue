import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import * as clack from "@clack/prompts";
import { plugsCommand } from "../../src/commands/plugs.js";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let project: TestProjectContext;
let exitSpy: ReturnType<typeof vi.spyOn>;
let originalCwd: string;

beforeEach(() => {
  project = setupTestProject({ skipFiles: true });
  originalCwd = process.cwd();
  process.chdir(project.projectDir);

  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined as never) as never);

  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.log.success).mockImplementation(() => {});
  vi.mocked(clack.log.info).mockImplementation(() => {});
  vi.mocked(clack.log.warn).mockImplementation(() => {});
  vi.mocked(clack.log.error).mockImplementation(() => {});
});

afterEach(async () => {
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  await project.cleanup();
});

function writeConfig(content: string) {
  writeFileSync(join(project.aligntrueDir, "config.yaml"), content);
}

function writeRule(filename: string, content: string) {
  mkdirSync(project.rulesDir, { recursive: true });
  writeFileSync(join(project.rulesDir, filename), content);
}

describe("plugs set contract", () => {
  it("fails when slot is not declared", async () => {
    writeConfig(
      [
        "mode: solo",
        "sources:",
        "  - type: local",
        "    path: .aligntrue/rules",
        "exporters:",
        "  - agents",
        "",
      ].join("\n"),
    );
    writeRule(
      "rule.md",
      ["---", 'title: "No slots"', "---", "", "# Rule", "", ""].join("\n"),
    );

    await plugsCommand(["set", "test.cmd", "pnpm test"]);

    expect(exitSpy).not.toHaveBeenCalled();
    const configYaml = readFileSync(
      join(project.aligntrueDir, "config.yaml"),
      "utf-8",
    );
    const config = yaml.parse(configYaml);
    expect(config.plugs?.fills?.["test.cmd"]).toBe("pnpm test");
  });

  it("persists fill when slot is declared", async () => {
    writeConfig(
      [
        "mode: solo",
        "sources:",
        "  - type: local",
        "    path: .aligntrue/rules",
        "exporters:",
        "  - agents",
        "",
      ].join("\n"),
    );
    writeRule(
      "rule.md",
      [
        "---",
        'title: "With slot"',
        "plugs:",
        "  slots:",
        "    test.cmd:",
        "      description: test command",
        "      format: command",
        "---",
        "",
        "# Rule",
        "",
        "[[plug:test.cmd]]",
        "",
      ].join("\n"),
    );

    await plugsCommand(["set", "test.cmd", "pnpm test"]);

    expect(exitSpy).not.toHaveBeenCalled();
    const configYaml = readFileSync(
      join(project.aligntrueDir, "config.yaml"),
      "utf-8",
    );
    const config = yaml.parse(configYaml);
    expect(config.plugs?.fills?.["test.cmd"]).toBe("pnpm test");
  });
});
