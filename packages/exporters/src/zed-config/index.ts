/**
 * Zed Config exporter
 * Exports AlignTrue sections to .zed/settings.json format
 *
 * TODO: Implement settings generation for sections format
 * Currently stub implementation.
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
}

export class ZedConfigExporter extends ExporterBase {
  name = "zed-config";
  version = "1.0.0";

  private state: ExporterState = {
    allSections: [],
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const sections = pack.sections;
    const { outputDir, dryRun = false } = options;

    if (sections.length === 0) {
      return { success: true, filesWritten: [], contentHash: "" };
    }

    const scopePath =
      scope.isDefault || scope.path === "." || scope.path === ""
        ? "all files"
        : scope.path;
    sections.forEach((section) =>
      this.state.allSections.push({ section, scopePath }),
    );

    const outputPath = join(outputDir, ".zed", "settings.json");
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const config: Record<string, unknown> = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: computeContentHash({
        sections: allSectionsIR,
      }),
      sections: this.state.allSections.map(({ section, scopePath: sp }) => ({
        heading: section.heading,
        level: section.level,
        content: section.content,
        fingerprint: section.fingerprint,
        scope: sp,
      })),
    };

    if (
      options.unresolvedPlugsCount !== undefined &&
      options.unresolvedPlugsCount > 0
    ) {
      config["unresolved_plugs"] = options.unresolvedPlugsCount;
    }

    const content = JSON.stringify(config, null, 2) + "\n";

    if (!dryRun) {
      mkdirSync(dirname(outputPath), { recursive: true });
      new AtomicFileWriter().write(outputPath, content);
    }

    return {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash: (config["content_hash"] as string) || "",
    };
  }

  resetState(): void {
    this.state = {
      allSections: [],
    };
  }
}

export default ZedConfigExporter;
