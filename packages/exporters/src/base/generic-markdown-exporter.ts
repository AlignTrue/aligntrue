/**
 * Generic Markdown Exporter
 * Base class for all AGENTS.md-style exporters (CLAUDE.md, WARP.md, etc.)
 *
 * Provides configurable filename, title, and description while sharing
 * all core functionality: sections, rules, mode hints, prioritization, etc.
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { join } from "path";
import { ExporterBase } from "./index.js";

/**
 * State for collecting all scopes before generating single merged file
 */
interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  seenScopes: Set<string>;
}

/**
 * Generic configurable markdown exporter
 * Used as delegate for agent-specific exporters
 */
export class GenericMarkdownExporter extends ExporterBase {
  name: string;
  version = "1.0.0";

  private filename: string; // e.g., "CLAUDE.md", "WARP.md"
  private title: string; // e.g., "CLAUDE.md", "WARP.md"
  private description: string; // e.g., "for Claude Code", "for Warp"

  // State for accumulating rules/sections across multiple scope calls
  private state: ExporterState = {
    allSections: [],
    seenScopes: new Set(),
  };

  constructor(
    name: string,
    filename: string,
    title: string,
    description: string,
  ) {
    super();
    this.name = name;
    this.filename = filename;
    this.title = title;
    this.description = description;
  }

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    // Validate inputs
    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate content with scope information
    const scopePath = this.formatScopePath(scope);

    sections.forEach((section) => {
      this.state.allSections.push({ section, scopePath });
    });

    this.state.seenScopes.add(scopePath);

    const outputPath = join(outputDir, this.filename);

    // Generate content - natural markdown mode
    const result = this.generateSectionsContent(options.unresolvedPlugsCount);
    const content = result.content;
    const warnings = result.warnings;

    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const filesWritten = await this.writeFile(outputPath, content, dryRun);
    const exportResult = this.buildResult(
      filesWritten,
      contentHash,
      fidelityNotes,
    );

    if (warnings.length > 0) {
      exportResult.warnings = warnings;
    }

    return exportResult;
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

  private generateSectionsContent(unresolvedPlugs?: number): {
    content: string;
    warnings: string[];
  } {
    // TODO: Implement generateHeader and generateFooter methods in subclasses
    const allSections = this.state.allSections.map(({ section }) => section);
    const sectionsMarkdown = this.renderSections(allSections, false);
    const contentHash = computeContentHash({ sections: allSections });
    const fidelityNotes = this.computeSectionFidelityNotes(allSections);

    // Build footer with hash and fidelity notes
    const footerLines: string[] = [];
    footerLines.push("---");
    footerLines.push(`**Content Hash:** ${contentHash}`);
    if (fidelityNotes.length > 0) {
      footerLines.push("");
      footerLines.push("**Fidelity Notes:**");
      fidelityNotes.forEach((note) => {
        footerLines.push(`- ${note}`);
      });
    }
    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      footerLines.push(`**Unresolved Plugs:** ${unresolvedPlugs}`);
    }
    const footer = footerLines.join("\n");

    return {
      content: `${sectionsMarkdown}\n\n${footer}`,
      warnings: [],
    };
  }
}

export default GenericMarkdownExporter;
