/**
 * Shared test utilities for exporter tests
 */
import { readFileSync } from "fs";
import { join } from "path";
import { computeHash, parseYamlToJson } from "@aligntrue/schema";
import type { Align, AlignSection } from "@aligntrue/schema";
import type {
  ScopedExportRequest,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";

/**
 * Generate a stable fingerprint for test fixtures
 */
function generateFingerprint(heading: string, content: string): string {
  const combined = `${heading}::${content}`;
  return computeHash(combined).substring(0, 16);
}

/**
 * Load test fixture YAML file and convert to AlignSection format
 */
export function loadFixture(
  fixturesDir: string,
  filename: string,
): { sections: AlignSection[] } {
  const filepath = join(fixturesDir, filename);
  const yaml = readFileSync(filepath, "utf-8");
  const data = parseYamlToJson(yaml) as Record<string, unknown>;

  // Handle both old rules format (for backward compat) and new sections format
  const sections = data.sections as AlignSection[] | undefined;
  if (sections) {
    return { sections };
  }

  // Legacy: convert rules to sections if needed
  const rules = data.rules as Array<{
    id: string;
    summary?: string;
    description?: string;
    [key: string]: unknown;
  }>;

  if (Array.isArray(rules)) {
    const converted = rules.map((rule, idx) => {
      const heading = rule.id || `Rule ${idx + 1}`;
      const content = rule.description || rule.summary || "";
      const fingerprint = generateFingerprint(heading, content);

      return {
        heading,
        level: 2,
        content,
        fingerprint,
      } as AlignSection;
    });
    return { sections: converted };
  }

  return { sections: [] };
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
