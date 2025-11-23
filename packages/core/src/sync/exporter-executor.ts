/**
 * Exporter execution logic for SyncEngine
 * orchestrates calling exporters for each scope
 */

import { posix } from "path";
import type { AlignPack } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";
import type { ResolvedScope } from "../scope.js";
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
  ir: AlignPack,
  config: AlignTrueConfig,
  fileWriter: AtomicFileWriter,
  options: {
    dryRun: boolean;
    interactive: boolean;
    force: boolean;
    unresolvedPlugsCount: number;
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

  // For each scope, merge rules and call exporters
  for (const scope of scopes) {
    // Build scoped pack (sections-only)
    // Note: Ideally we'd filter sections by scope here, but current logic just passes full IR
    // Scoped merge logic will be enhanced in future
    let scopedPack: AlignPack = {
      id: ir.id,
      version: ir.version,
      spec_version: ir.spec_version,
      sections: ir.sections,
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
      const { resolvePlugsForPack } = await import("../plugs/index.js");
      const resolved = resolvePlugsForPack(scopedPack, config.plugs.fills);

      if (resolved.success && resolved.rules.length > 0) {
        // Update sections with resolved content
        scopedPack.sections = scopedPack.sections.map((section, idx) => {
          const resolvedRule = resolved.rules[idx];
          if (resolvedRule?.guidance) {
            return {
              ...section,
              content: resolvedRule.guidance,
            };
          }
          return section;
        });
      }
    }

    // Call each exporter with scoped pack
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
        pack: scopedPack,
        outputPath,
      };

      const exportOptions: ExportOptions = {
        outputDir: process.cwd(),
        dryRun: options.dryRun,
        backup: true,
        unresolvedPlugsCount: options.unresolvedPlugsCount,
        managedSections: config.managed?.sections || [],
        ...(config.plugs?.fills && {
          plugFills: config.plugs.fills,
        }),
        interactive: options.interactive,
        force: options.force,
        config: config,
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
