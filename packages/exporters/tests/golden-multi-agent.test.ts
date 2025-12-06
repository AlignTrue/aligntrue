import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { AgentsExporter } from "../src/agents/index.js";
import { CursorExporter } from "../src/cursor/index.js";
import { VsCodeMcpExporter } from "../src/vscode-mcp/index.js";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");
const GOLDEN_DIR = join(import.meta.dirname, "__fixtures__", "multi-agent");

describe("multi-agent golden determinism", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), "exporters-golden-"));
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("exports identical bytes for Cursor, AGENTS.md, and VS Code MCP", async () => {
    const { sections } = loadFixture(FIXTURES_DIR, "multi-agent.yaml");
    const scope = createDefaultScope();

    const agents = new AgentsExporter();
    const cursor = new CursorExporter();
    const vscode = new VsCodeMcpExporter();

    await agents.export(
      {
        scope,
        align: {
          id: "multi-agent",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
        outputPath: join(outputDir, "AGENTS.md"),
      },
      { outputDir, dryRun: false },
    );

    await cursor.export(
      {
        scope,
        align: {
          id: "multi-agent",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
        outputPath: join(outputDir, ".cursor/rules"),
      },
      { outputDir, dryRun: false },
    );

    await vscode.export(
      {
        scope,
        align: {
          id: "multi-agent",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
        outputPath: join(outputDir, ".vscode/mcp.json"),
      },
      {
        outputDir,
        dryRun: false,
        config: {
          mcp: {
            servers: [
              { name: "test-server", command: "node", args: ["./server.js"] },
            ],
          },
        },
      },
    );

    const read = (relativePath: string) =>
      readFileSync(join(outputDir, relativePath), "utf-8");
    const readGolden = (relativePath: string) =>
      readFileSync(join(GOLDEN_DIR, relativePath), "utf-8");

    expect(read("AGENTS.md")).toBe(readGolden("agents.golden.md"));
    expect(read(".cursor/rules/security-baseline.mdc")).toBe(
      readGolden("cursor/security-baseline.golden.mdc"),
    );
    expect(read(".cursor/rules/observability-defaults.mdc")).toBe(
      readGolden("cursor/observability-defaults.golden.mdc"),
    );
    expect(read(".cursor/rules/scoped-build-hygiene.mdc")).toBe(
      readGolden("cursor/scoped-build-hygiene.golden.mdc"),
    );
    expect(read(".vscode/mcp.json")).toBe(readGolden("vscode/mcp.golden.json"));
  });
});
