/**
 * Shared test utilities for exporter tests
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseYamlToJson } from "@aligntrue/schema";
import type { AlignRule } from "@aligntrue/schema";
import type {
  ScopedExportRequest,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";

/**
 * Load test fixture YAML file and extract rules
 */
export function loadFixture(
  fixturesDir: string,
  filename: string,
): { rules: AlignRule[] } {
  const filepath = join(fixturesDir, filename);
  const yaml = readFileSync(filepath, "utf-8");
  const data = parseYamlToJson(yaml) as Record<string, unknown>;
  return { rules: data.rules as AlignRule[] };
}

/**
 * Create scoped export request for testing
 * Note: Tests can keep local createRequest() if they need custom outputPath logic
 */
export function createRequest(
  rules: AlignRule[],
  scope: ResolvedScope,
  outputPath: string,
): ScopedExportRequest {
  return {
    scope,
    rules,
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
