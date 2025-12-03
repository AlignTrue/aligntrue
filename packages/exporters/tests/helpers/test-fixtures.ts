/**
 * Shared test utilities for exporter tests
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseYamlToJson } from "@aligntrue/schema";
import type { Align, AlignSection } from "@aligntrue/schema";
import type {
  ScopedExportRequest,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";

/**
 * Load test fixture YAML file and return sections
 */
export function loadFixture(
  fixturesDir: string,
  filename: string,
): { sections: AlignSection[] } {
  const filepath = join(fixturesDir, filename);
  const yaml = readFileSync(filepath, "utf-8");
  const data = parseYamlToJson(yaml) as Record<string, unknown>;

  const sections = data.sections as AlignSection[] | undefined;
  return { sections: sections ?? [] };
}

/**
 * Create scoped export request for testing
 */
export function createRequest(
  sections: AlignSection[],
  scope: ResolvedScope,
  outputPath: string = "test-output",
): ScopedExportRequest {
  const align: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  return {
    scope,
    align,
    outputPath,
  };
}

/**
 * Create default scope for testing
 */
export function createDefaultScope(): ResolvedScope {
  return {
    path: ".",
    normalizedPath: ".",
    isDefault: true,
    include: ["**/*"],
  };
}
