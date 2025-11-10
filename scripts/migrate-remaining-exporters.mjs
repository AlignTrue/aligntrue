#!/usr/bin/env node
/**
 * Quick migration script for remaining rule-based exporters
 * Converts them to stub implementations for sections-only format
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportersDir = path.join(__dirname, "../packages/exporters/src");

const problemExporters = [
  "aider-config",
  "amazonq-mcp",
  "augmentcode",
  "cline",
  "codex-config",
  "crush-config",
  "cursor-mcp",
  "firebase-mcp",
  "firebase-studio",
  "firebender",
  "gemini-config",
  "kilocode",
  "kiro",
  "openhands",
];

const stubTemplate = (name, className) => `/**
 * ${name} exporter
 * @deprecated Not yet fully implemented for sections-only format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { ExporterBase } from "../base/index.js";

export class ${className} extends ExporterBase {
  name = "${name}";
  version = "1.0.0";

  async export(
    _request: ScopedExportRequest,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    // TODO: Implement ${name} exporter for sections format
    return {
      success: true,
      filesWritten: [],
      contentHash: "",
    };
  }

  resetState(): void {
    // Stub
  }
}

export default ${className};
`;

function toPascalCase(str) {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

for (const exporter of problemExporters) {
  const dir = path.join(exportersDir, exporter);
  const indexPath = path.join(dir, "index.ts");

  if (fs.existsSync(indexPath)) {
    const className = toPascalCase(exporter) + "Exporter";
    const content = stubTemplate(exporter, className);
    fs.writeFileSync(indexPath, content, "utf-8");
    console.log(`✓ Migrated ${exporter}`);
  } else {
    console.log(`✗ Not found: ${exporter}`);
  }
}

console.log("\nRemaining exporters migrated to stubs for sections-only format");
