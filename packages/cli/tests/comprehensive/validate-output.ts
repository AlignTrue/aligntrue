/**
 * Output validation utility for comprehensive CLI testing
 * Parses test execution logs and generates structured reports
 */

import { readFileSync, existsSync } from "node:fs";

export type Severity = "P0" | "P1" | "P2" | "P3";

export interface TestIssue {
  command: string;
  expected: string;
  actual: string;
  severity: Severity;
  rootCause?: string;
  layer: number;
}

export interface TestResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration?: number;
  passed: boolean;
}

export interface ValidationReport {
  timestamp: string;
  commit: string;
  layer: number;
  totalTests: number;
  passed: number;
  failed: number;
  issues: TestIssue[];
  results: TestResult[];
}

/**
 * Parse test log file and extract test results
 */
export function parseTestLog(logPath: string): TestResult[] {
  if (!existsSync(logPath)) {
    throw new Error(`Log file not found: ${logPath}`);
  }

  const content = readFileSync(logPath, "utf-8");
  const results: TestResult[] = [];
  const lines = content.split("\n");

  let currentCommand = "";
  let currentStdout = "";
  let currentStderr = "";
  let currentExitCode = 0;

  for (const line of lines) {
    // Match command execution
    if (line.includes("Executing:")) {
      if (currentCommand) {
        results.push({
          command: currentCommand,
          exitCode: currentExitCode,
          stdout: currentStdout.trim(),
          stderr: currentStderr.trim(),
          passed: currentExitCode === 0,
        });
      }
      currentCommand = line.split("Executing:")[1]?.trim() || "";
      currentStdout = "";
      currentStderr = "";
      currentExitCode = 0;
    }

    // Match exit code
    if (line.includes("Exit code:")) {
      const match = line.match(/Exit code: (\d+)/);
      if (match) {
        currentExitCode = parseInt(match[1], 10);
      }
    }

    // Collect stdout/stderr
    if (
      currentCommand &&
      !line.includes("Executing:") &&
      !line.includes("Exit code:")
    ) {
      if (line.includes("ERROR") || line.includes("FAIL")) {
        currentStderr += line + "\n";
      } else {
        currentStdout += line + "\n";
      }
    }
  }

  // Add last result
  if (currentCommand) {
    results.push({
      command: currentCommand,
      exitCode: currentExitCode,
      stdout: currentStdout.trim(),
      stderr: currentStderr.trim(),
      passed: currentExitCode === 0,
    });
  }

  return results;
}

/**
 * Validate exit codes match expected values
 */
export function validateExitCodes(results: TestResult[]): TestIssue[] {
  const issues: TestIssue[] = [];

  for (const result of results) {
    // Commands that should succeed
    const shouldSucceed = [
      "aligntrue --help",
      "aligntrue --version",
      "aligntrue init",
      "aligntrue sync",
      "aligntrue check",
    ];

    const isSuccessCommand = shouldSucceed.some((cmd) =>
      result.command.includes(cmd),
    );

    if (isSuccessCommand && result.exitCode !== 0) {
      issues.push({
        command: result.command,
        expected: "Exit code 0",
        actual: `Exit code ${result.exitCode}`,
        severity: "P1",
        rootCause: "Command failed unexpectedly",
        layer: 0,
      });
    }
  }

  return issues;
}

/**
 * Validate file existence from test results
 */
export function validateFiles(
  expectedFiles: string[],
  testDir: string,
): TestIssue[] {
  const issues: TestIssue[] = [];

  for (const file of expectedFiles) {
    const fullPath = `${testDir}/${file}`;
    if (!existsSync(fullPath)) {
      issues.push({
        command: "file check",
        expected: `File exists: ${file}`,
        actual: "File not found",
        severity: "P1",
        rootCause: "Expected file was not created",
        layer: 0,
      });
    }
  }

  return issues;
}

/**
 * Validate output patterns
 */
export function validateOutputPatterns(
  results: TestResult[],
  patterns: { command: string; pattern: RegExp; description: string }[],
): TestIssue[] {
  const issues: TestIssue[] = [];

  for (const { command, pattern, description } of patterns) {
    const result = results.find((r) => r.command.includes(command));
    if (!result) {
      continue;
    }

    const output = result.stdout + result.stderr;
    if (!pattern.test(output)) {
      issues.push({
        command: result.command,
        expected: description,
        actual: "Pattern not found in output",
        severity: "P2",
        rootCause: "Output format mismatch",
        layer: 0,
      });
    }
  }

  return issues;
}

/**
 * Generate structured JSON report
 */
export function generateReport(
  layer: number,
  commit: string,
  results: TestResult[],
  issues: TestIssue[],
): ValidationReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    timestamp: new Date().toISOString(),
    commit,
    layer,
    totalTests: results.length,
    passed,
    failed,
    issues: issues.map((issue) => ({ ...issue, layer })),
    results,
  };
}

/**
 * Format report as markdown
 */
export function formatMarkdown(report: ValidationReport): string {
  const { timestamp, commit, layer, totalTests, passed, failed, issues } =
    report;

  let md = `## Test Run ${new Date(timestamp).toLocaleDateString()}\n\n`;
  md += `**Commit:** ${commit}\n`;
  md += `**Layer:** ${layer}\n`;
  md += `**Duration:** ~${Math.ceil(totalTests * 2)} minutes\n\n`;
  md += `**Test Results:**\n\n`;
  md += `- Total: ${totalTests}\n`;
  md += `- Passed: ${passed}\n`;
  md += `- Failed: ${failed}\n\n`;

  if (issues.length > 0) {
    md += `**Issues Found:**\n\n`;
    const byseverity = {
      P0: issues.filter((i) => i.severity === "P0"),
      P1: issues.filter((i) => i.severity === "P1"),
      P2: issues.filter((i) => i.severity === "P2"),
      P3: issues.filter((i) => i.severity === "P3"),
    };

    for (const [severity, severityIssues] of Object.entries(byseverity)) {
      if (severityIssues.length > 0) {
        md += `**${severity} Issues:**\n\n`;
        for (const issue of severityIssues) {
          md += `- ${issue.command}\n`;
          md += `  - Expected: ${issue.expected}\n`;
          md += `  - Actual: ${issue.actual}\n`;
          if (issue.rootCause) {
            md += `  - Root cause: ${issue.rootCause}\n`;
          }
          md += `\n`;
        }
      }
    }
  } else {
    md += `**No issues found** ✓\n\n`;
  }

  return md;
}
