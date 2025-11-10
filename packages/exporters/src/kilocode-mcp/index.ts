/**
 * Kilocode MCP exporter
 * Exports AlignTrue rules to .kilocode/mcp.json MCP configuration format
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
  seenScopes: Set<string>;
}

interface McpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  sections: McpSection[];
  fidelity_notes?: string[];
}

interface McpSection {
  heading: string;
  level: number;
  content: string;
  fingerprint: string;
  scope?: string;
  [key: string]: unknown;
}

export class KilcodeMcpExporter extends ExporterBase {
  name = "kilocode-mcp";
  version = "1.0.0";

  private state: ExporterState = {
    allSections: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

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
    this.state.seenScopes.add(scopePath);

    const outputPath = join(outputDir, ".kilocode", "mcp.json");
    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const content = JSON.stringify(mcpConfig, null, 2) + "\n";
    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  private generateMcpConfig(unresolvedPlugs?: number): McpConfig {
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const mcpSections = this.state.allSections.map(({ section, scopePath }) =>
      this.mapSectionToMcpFormat(section, scopePath),
    );

    const config: McpConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      sections: mcpSections,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config["unresolved_plugs"] = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    return config;
  }

  private mapSectionToMcpFormat(
    section: AlignSection,
    scopePath: string,
  ): McpSection {
    const mcpSection: McpSection = {
      heading: section.heading,
      level: section.level,
      content: section.content,
      fingerprint: section.fingerprint,
    };

    if (scopePath !== "all files") {
      mcpSection.scope = scopePath;
    }

    return mcpSection;
  }

  resetState(): void {
    this.state = {
      allSections: [],
      seenScopes: new Set(),
    };
  }
}

export default KilcodeMcpExporter;
