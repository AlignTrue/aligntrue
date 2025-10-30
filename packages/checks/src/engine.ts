/**
 * Main checks engine orchestrator
 */

import { join } from "path";
import type { AlignPack } from "@aligntrue/schema";
import type { CheckResult, CheckContext, RunChecksOptions } from "./types.js";
import { hasCheck } from "./types.js";
import { DiskFileProvider } from "./providers/disk.js";
import { runFilePresenceCheck } from "./runners/file-presence.js";
import { runPathConventionCheck } from "./runners/path-convention.js";
import { runManifestPolicyCheck } from "./runners/manifest-policy.js";
import { runRegexCheck } from "./runners/regex.js";
import { runCommandRunnerCheck } from "./runners/command-runner.js";
import {
  parseTeamYaml,
  applySeverityRemap,
  type SeverityRemap,
  type AlignSeverity,
} from "@aligntrue/core";

/**
 * Run all checks for an Align pack
 *
 * @param alignPack - Validated Align pack object
 * @param options - Execution options
 * @returns Array of check results (one per rule)
 */
export async function runChecks(
  alignPack: AlignPack,
  options: RunChecksOptions = {},
): Promise<CheckResult[]> {
  const fileProvider =
    options.fileProvider || new DiskFileProvider(options.workingDir);
  const workingDir = options.workingDir || process.cwd();

  const context: CheckContext = {
    fileProvider,
    workingDir,
    executionConfig: {
      allowExec: options.allowExec ?? false,
      ...(options.envWhitelist ? { envWhitelist: options.envWhitelist } : {}),
      ...(options.defaultTimeout
        ? { defaultTimeout: options.defaultTimeout }
        : {}),
    },
    ...(options.changedFiles ? { changedFiles: options.changedFiles } : {}),
  };

  const results: CheckResult[] = [];

  for (const rule of alignPack.rules) {
    const result = await runCheck(rule, alignPack.id, context);
    results.push(result);
  }

  // Apply severity remapping in team mode
  if (options.mode === "team") {
    return applySeverityRemapping(
      results,
      options.teamYamlPath || join(workingDir, ".aligntrue.team.yaml"),
    );
  }

  return results;
}

/**
 * Run a single check based on its type
 */
async function runCheck(
  rule: AlignPack["rules"][0],
  packId: string,
  context: CheckContext,
): Promise<CheckResult> {
  // Skip rules without checks
  if (!hasCheck(rule)) {
    return {
      rule,
      packId,
      pass: true,
      findings: [],
    };
  }

  const checkType = rule.check.type;

  switch (checkType) {
    case "file_presence":
      return runFilePresenceCheck(rule, packId, context);
    case "path_convention":
      return runPathConventionCheck(rule, packId, context);
    case "manifest_policy":
      return runManifestPolicyCheck(rule, packId, context);
    case "regex":
      return runRegexCheck(rule, packId, context);
    case "command_runner":
      return runCommandRunnerCheck(rule, packId, context);
    default:
      return {
        rule,
        packId,
        pass: false,
        findings: [],
        error: `Unknown check type: ${checkType}`,
      };
  }
}

/**
 * Apply severity remapping to check results
 *
 * @param results - Check results to remap
 * @param teamYamlPath - Path to .aligntrue.team.yaml file
 * @returns Results with remapped severity levels
 */
function applySeverityRemapping(
  results: CheckResult[],
  teamYamlPath: string,
): CheckResult[] {
  // Try to load team.yaml file
  let remaps: SeverityRemap[] = [];

  try {
    const teamYaml = parseTeamYaml(teamYamlPath);
    remaps = teamYaml.severity_remaps;
  } catch {
    // If file doesn't exist or is invalid, no remapping
    return results;
  }

  // If no remaps defined, return unchanged
  if (remaps.length === 0) {
    return results;
  }

  // Map IR severity to RFC 2119 severity for remap lookup
  const irToRfc2119 = (irSeverity: string): AlignSeverity => {
    switch (irSeverity) {
      case "error":
        return "MUST";
      case "warn":
        return "SHOULD";
      case "info":
        return "MAY";
      default:
        return "MUST"; // Fallback
    }
  };

  // Apply remaps to each result
  return results.map((result) => {
    const irSeverity = result.rule.severity;

    // Skip if no severity defined
    if (!irSeverity) {
      return result;
    }

    // Convert IR severity to RFC 2119 for remap lookup
    const rfc2119Severity = irToRfc2119(irSeverity);

    // Apply remap (returns check severity)
    const remappedSeverity = applySeverityRemap(
      result.rule.id,
      rfc2119Severity,
      remaps,
    );

    // If no change from original IR severity, return unchanged
    if (remappedSeverity === irSeverity) {
      return result;
    }

    // Apply remap to findings
    const remappedFindings = result.findings.map((finding) => ({
      ...finding,
      severity: remappedSeverity,
    }));

    // Return with metadata
    return {
      ...result,
      findings: remappedFindings,
      metadata: {
        ...result.metadata,
        originalSeverity: rfc2119Severity,
        remappedSeverity,
      },
    };
  });
}
