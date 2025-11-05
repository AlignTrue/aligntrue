/**
 * Regex check runner
 */

import type { AlignRule } from "@aligntrue/schema";
import type { CheckResult, CheckContext } from "../types.js";
import { hasCheck } from "../types.js";

/**
 * Run regex check
 *
 * Pattern matching against file contents.
 * If allow=true, pattern MUST match. If allow=false, pattern MUST NOT match.
 */
export async function runRegexCheck(
  rule: AlignRule,
  packId: string,
  context: CheckContext,
): Promise<CheckResult> {
  const { fileProvider } = context;

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

  if (rule.check.type !== "regex") {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: "Check type mismatch: expected regex",
    };
  }

  const pattern = inputs["pattern"] as string;
  const include = inputs["include"] as string[];
  const allow = inputs["allow"] as boolean;

  try {
    const regex = new RegExp(pattern, "gm");
    const findings: CheckResult["findings"] = [];

    // Check each include pattern
    for (const includePattern of include) {
      const files = await fileProvider.glob(includePattern);

      for (const file of files) {
        const content = await fileProvider.readFile(file);
        const matches = content.matchAll(regex);
        const matchArray = Array.from(matches);

        if (allow && matchArray.length === 0) {
          // Pattern MUST match but doesn't
          findings.push({
            packId,
            ruleId: rule.id,
            severity: rule.severity,
            evidence,
            message: `${evidence}: ${file} (expected to match /${pattern}/)`,
            location: { path: file },
            ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
          });
        } else if (!allow && matchArray.length > 0) {
          // Pattern MUST NOT match but does
          // Report each match with line number
          for (const match of matchArray) {
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split("\n").length;

            findings.push({
              packId,
              ruleId: rule.id,
              severity: rule.severity,
              evidence,
              message: `${evidence}: ${file}:${lineNumber} (found "${match[0]}")`,
              location: { path: file, line: lineNumber },
              ...(rule.autofix?.hint && { autofixHint: rule.autofix.hint }),
            });
          }
        }
      }
    }

    return {
      rule,
      packId,
      pass: findings.length === 0,
      findings,
    };
  } catch (_err) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: _err instanceof Error ? _err.message : "Unknown error",
    };
  }
}
