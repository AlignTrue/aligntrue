import { mkdirSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import {
  computeRulePaths,
  resolveConflict,
  writeRuleFile,
  type ConflictInfo,
} from "@aligntrue/core";
import type { RuleFile } from "@aligntrue/schema";
import { isTTY } from "../../utils/tty-helper.js";
import type { createManagedSpinner } from "../../utils/spinner.js";

export async function writeRulesWithConflicts(options: {
  rules: RuleFile[];
  conflicts: ConflictInfo[];
  cwd: string;
  rulesDir: string;
  nonInteractive: boolean;
  replaceConflicts?: boolean;
  skipConflicts?: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<string[]> {
  const {
    rules,
    conflicts,
    cwd,
    rulesDir,
    nonInteractive,
    replaceConflicts,
    skipConflicts,
    spinner,
  } = options;
  const rulesToWrite = [...rules];

  if (conflicts.length > 0) {
    spinner.stop(`Found ${rules.length} rules`);

    const conflictHeader = `${conflicts.length} conflict${
      conflicts.length === 1 ? "" : "s"
    } detected:`;
    if (isTTY()) {
      clack.log.warn(conflictHeader);
      conflicts.forEach((c) =>
        clack.log.info(`  • ${c.filename} (already exists)`),
      );
    } else {
      console.warn(conflictHeader);
      conflicts.forEach((c) =>
        console.warn(`  • ${c.filename} (already exists)`),
      );
    }

    for (const conflict of conflicts) {
      let resolution: "replace" | "keep-both" | "skip";

      if (skipConflicts) {
        resolution = "skip";
      } else if (replaceConflicts) {
        resolution = "replace";
      } else if (nonInteractive) {
        resolution = "keep-both";
      } else {
        const choice = await clack.select({
          message: `Rule "${conflict.filename}" already exists. What do you want to do?`,
          options: [
            {
              value: "replace",
              label: "Replace - Overwrite existing (backup saved)",
            },
            {
              value: "keep-both",
              label: "Keep both - Save incoming as new file",
            },
            { value: "skip", label: "Skip - Don't import this rule" },
          ],
        });

        if (clack.isCancel(choice)) {
          clack.cancel("Import cancelled");
          process.exit(0);
        }

        resolution = choice as "replace" | "keep-both" | "skip";
      }

      const resolved = resolveConflict(conflict, resolution, cwd);

      const ruleIndex = rulesToWrite.findIndex((r) => {
        const ruleName = r.relativePath || r.filename;
        return ruleName === conflict.filename;
      });
      if (ruleIndex !== -1) {
        if (resolved.resolution === "skip") {
          rulesToWrite.splice(ruleIndex, 1);
        } else {
          const rule = rulesToWrite[ruleIndex]!;
          const baseDir = rule.relativePath ? dirname(rule.relativePath) : "";
          const resolvedName = resolved.finalFilename;
          const finalRelative =
            /[\\/]/.test(resolvedName) || !baseDir || baseDir === "."
              ? resolvedName
              : join(baseDir, resolvedName);
          const updatedPaths = computeRulePaths(join(rulesDir, finalRelative), {
            cwd,
            rulesDir,
          });

          const actionDescription =
            resolved.resolution === "replace"
              ? `replaced existing${resolved.backupPath ? ` (backup: ${resolved.backupPath})` : ""}`
              : resolved.resolution === "keep-both"
                ? `kept both as ${resolved.finalFilename}`
                : "skipped";
          if (isTTY()) {
            clack.log.info(`  → ${conflict.filename}: ${actionDescription}`);
          } else {
            console.log(`  -> ${conflict.filename}: ${actionDescription}`);
          }

          rule.filename = updatedPaths.filename;
          rule.relativePath = updatedPaths.relativePath;
          rule.path = updatedPaths.path;

          if (resolved.backupPath && isTTY()) {
            clack.log.info(`Backed up existing rule to ${resolved.backupPath}`);
          }
        }
      }
    }

    spinner.start("Writing rules...");
  }

  const createdFiles: string[] = [];
  for (const rule of rulesToWrite) {
    const fullPath = join(rulesDir, rule.relativePath || rule.filename);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeRuleFile(fullPath, rule);
    createdFiles.push(rule.relativePath || rule.filename);
  }

  return createdFiles;
}
