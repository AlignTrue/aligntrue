/**
 * File presence check runner
 */

import type { AlignRule } from "@aligntrue/schema";
import type { CheckResult, CheckContext } from "../types.js";
import { hasCheck } from "../types.js";

/**
 * Run file_presence check
 *
 * Verifies that files matching a pattern exist.
 * Optionally checks that test files exist for changed sources.
 */
export async function runFilePresenceCheck(
  rule: AlignRule,
  packId: string,
  context: CheckContext,
): Promise<CheckResult> {
  const { fileProvider, changedFiles } = context;

  if (!hasCheck(rule)) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: "Rule does not have a check property",
    };
  }

  const { inputs, evidence = "Check failed" } = rule.check;

  if (rule.check.type !== "file_presence") {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: "Check type mismatch: expected file_presence",
    };
  }

  const pattern = inputs["pattern"] as string;
  const mustExistForChangedSources = inputs[
    "must_exist_for_changed_sources"
  ] as boolean | undefined;

  try {
    const matchedFiles = await fileProvider.glob(pattern);

    // If no specific changed files, just check if pattern matches anything
    if (
      !mustExistForChangedSources ||
      !changedFiles ||
      changedFiles.length === 0
    ) {
      if (matchedFiles.length === 0) {
        return {
          rule,
          packId,
          pass: false,
          findings: [
            {
              packId,
              ruleId: rule.id,
              severity: rule.severity,
              evidence,
              message: `No files found matching pattern: ${pattern}`,
              location: { path: "." },
              ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
            },
          ],
        };
      }

      return {
        rule,
        packId,
        pass: true,
        findings: [],
      };
    }

    // Check that each changed source file has a corresponding test file
    const findings: CheckResult["findings"] = [];

    for (const changedFile of changedFiles) {
      // Simple heuristic: if changed file is a source file, ensure a matching test exists
      // This is a basic implementation; real logic would be more sophisticated
      const hasMatch = matchedFiles.some((testFile) => {
        // Check if test file corresponds to changed file
        const baseName = changedFile.replace(/\.[^/.]+$/, "");
        return testFile.includes(baseName);
      });

      if (!hasMatch) {
        findings.push({
          packId,
          ruleId: rule.id,
          severity: rule.severity,
          evidence,
          message: `${evidence}: ${changedFile}`,
          location: { path: changedFile },
          ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
        });
      }
    }

    return {
      rule,
      packId,
      pass: findings.length === 0,
      findings,
    };
  } catch (err) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
