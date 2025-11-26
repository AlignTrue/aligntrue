/**
 * Goose exporter
 * Exports AlignTrue rules to Goose .goosehints format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
}

export class GooseExporter extends ExporterBase {
  name = "goose";
  version = "1.0.0";

  private state: ExporterState = {
    allSections: [],
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, align } = request;
    const { outputDir, dryRun = false } = options;

    const sections = align.sections;

    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const scopePath = this.formatScopePath(scope);
    sections.forEach((section) => {
      this.state.allSections.push({ section, scopePath });
    });

    const outputPath = join(outputDir, ".goosehints");

    // Generate content from sections
    const lines: string[] = [];
    lines.push("# Goose Hints");
    lines.push("");

    // Render sections as plain text
    sections.forEach((section) => {
      lines.push(`# ${section.heading}`);
      lines.push(section.content);
      lines.push("");
    });

    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    if (
      options.unresolvedPlugsCount !== undefined &&
      options.unresolvedPlugsCount > 0
    ) {
      lines.push(`# Unresolved Plugs: ${options.unresolvedPlugsCount}`);
    }

    const content = lines.join("\n");
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  resetState(): void {
    this.state = {
      allSections: [],
    };
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }
}

export default GooseExporter;
