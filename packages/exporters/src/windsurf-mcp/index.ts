/**
 * Windsurf MCP config exporter
 * Exports AlignTrue sections to .windsurf/mcp_config.json format
 *
 * TODO: Implement MCP config generation for sections format
 * Currently stub implementation.
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
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

export class WindsurfMcpExporter extends ExporterBase {
  name = "windsurf-mcp";
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
    const sections = pack.sections;
    const { outputDir, dryRun = false } = options;

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

    const outputPath = join(outputDir, ".windsurf", "mcp_config.json");

    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    if (!dryRun) {
      const windsurfDirPath = dirname(outputPath);
      mkdirSync(windsurfDirPath, { recursive: true });
    }

    const filesWritten = await this.writeFile(outputPath, content, dryRun);
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });

    return this.buildResult(filesWritten, contentHash);
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
      config.unresolved_plugs = unresolvedPlugs;
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

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }
}

export default WindsurfMcpExporter;
