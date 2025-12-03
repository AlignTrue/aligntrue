/**
 * Exporter execution logic for SyncEngine
 * orchestrates calling exporters for each scope
 */

import { posix } from "path";
import type { Align } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";
import { filterSectionsByScope, type ResolvedScope } from "../scope.js";
import type { AtomicFileWriter } from "@aligntrue/file-utils";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import type { AuditEntry, OperationResult } from "./engine.js";

export interface ExporterExecutionResult extends OperationResult {
  written: string[];
  warnings: string[];
  auditTrail: AuditEntry[];
  exportResults: Map<string, ExportResult>;
}

/**
 * Execute exporters for all scopes
 */
export async function executeExporters(
  exporters: ExporterPlugin[],
  scopes: ResolvedScope[],
  ir: Align,
  config: AlignTrueConfig,
  fileWriter: AtomicFileWriter,
  options: {
    dryRun: boolean;
    interactive: boolean;
    force: boolean;
    unresolvedPlugsCount: number;
    contentMode?: "auto" | "inline" | "links";
  },
): Promise<ExporterExecutionResult> {
  const written: string[] = [];
  const warnings: string[] = [];
  const auditTrail: AuditEntry[] = [];
  const exportResults = new Map<string, ExportResult>();

  // Reset state on all exporters
  for (const exporter of exporters) {
    exporter.resetState?.();
  }

  // For each scope, filter sections and call exporters
  for (const scope of scopes) {
    // Filter sections by scope
    const scopedSections = filterSectionsByScope(ir.sections, scope);

    // Build scoped align with filtered sections
    let scopedAlign: Align = {
      id: ir.id,
      version: ir.version,
      spec_version: ir.spec_version,
      sections: scopedSections,
      ...(ir.summary && { summary: ir.summary }),
      ...(ir.owner && { owner: ir.owner }),
      ...(ir.source && { source: ir.source }),
      ...(ir.source_sha && { source_sha: ir.source_sha }),
      ...(ir.vendor_path && { vendor_path: ir.vendor_path }),
      ...(ir.vendor_type && { vendor_type: ir.vendor_type }),
      ...(ir.tags && { tags: ir.tags }),
      ...(ir.deps && { deps: ir.deps }),
      ...(ir.scope && { scope: ir.scope }),
      ...(ir.plugs && { plugs: ir.plugs }),
      ...(ir.integrity && { integrity: ir.integrity }),
      ...(ir._markdown_meta && {
        _markdown_meta: ir._markdown_meta,
      }),
    };

    // Resolve plugs if config fills are provided
    if (config.plugs?.fills && Object.keys(config.plugs.fills).length > 0) {
      const { resolvePlugsForAlign } = await import("../plugs/index.js");
      const resolved = resolvePlugsForAlign(scopedAlign, config.plugs.fills);

      if (resolved.success && resolved.rules.length > 0) {
        // Update sections with resolved content
        scopedAlign.sections = scopedAlign.sections.map((section, idx) => {
          const resolvedRule = resolved.rules[idx];
          if (resolvedRule?.content) {
            return {
              ...section,
              content: resolvedRule.content,
            };
          }
          return section;
        });
      }
    }

    // Call each exporter with scoped align
    for (const exporter of exporters) {
      const outputPath = `.${exporter.name}/${scope.path === "." ? "root" : scope.path}`;

      // Security: Validate output paths don't escape workspace
      if (outputPath.includes("..") || posix.isAbsolute(outputPath)) {
        warnings.push(
          `Skipped ${exporter.name} for scope ${scope.path}: invalid output path "${outputPath}"`,
        );
        continue;
      }

      const request: ScopedExportRequest = {
        scope,
        align: scopedAlign,
        outputPath,
      };

      const exportOptions: ExportOptions = {
        outputDir: process.cwd(),
        dryRun: options.dryRun,
        backup: true,
        unresolvedPlugsCount: options.unresolvedPlugsCount,
        ...(config.plugs?.fills && {
          plugFills: config.plugs.fills,
        }),
        interactive: options.interactive,
        force: options.force,
        config: config,
        ...(options.contentMode && {
          contentMode: options.contentMode,
        }),
      };

      try {
        const DEBUG_SYNC = process.env["DEBUG_SYNC"] === "true";
        if (DEBUG_SYNC) {
          console.log(
            `[SyncEngine] Exporting ${exporter.name} for scope ${scope.path}`,
          );
        }

        const result = await exporter.export(request, exportOptions);
        exportResults.set(`${exporter.name}:${scope.path}`, result);

        if (result.success) {
          written.push(...result.filesWritten);

          // Audit trail: Files written
          for (const file of result.filesWritten) {
            auditTrail.push({
              action: options.dryRun ? "update" : "create",
              target: file,
              source: `${exporter.name} exporter`,
              hash: result.contentHash,
              timestamp: new Date().toISOString(),
              details: options.dryRun
                ? `Would write file (dry-run)`
                : `Wrote file successfully`,
            });
          }

          // Track files for overwrite protection (if not dry-run)
          if (!options.dryRun) {
            for (const file of result.filesWritten) {
              try {
                fileWriter.trackFile(file);
              } catch {
                // Ignore tracking errors
              }
            }
          }

          // Collect fidelity notes as warnings
          if (result.fidelityNotes && result.fidelityNotes.length > 0) {
            warnings.push(
              ...result.fidelityNotes.map(
                (note: string) => `[${exporter.name}] ${note}`,
              ),
            );
          }
        } else {
          throw new Error(
            `Exporter ${exporter.name} failed for scope ${scope.path}`,
          );
        }
      } catch (_err) {
        // Rollback on error
        if (!options.dryRun) {
          try {
            fileWriter.rollback();
          } catch (rollbackErr) {
            warnings.push(
              `Rollback warning: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
            );
          }
        }

        throw new Error(
          `Export failed for ${exporter.name} (scope: ${scope.path})\n` +
            `  ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }
    }
  }

  return { written, warnings, auditTrail, exportResults };
}
