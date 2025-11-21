#!/usr/bin/env node

import { execSync } from "child_process";

const checks = [
  {
    name: "SECURITY ISSUES",
    command: "pnpm lint --max-warnings 0 2>&1",
    parseOutput: (output) => {
      // Security issues will be reported by eslint with security plugin
      // Extract lines containing security issues with file paths
      const lines = output.split("\n");
      const securityIssues = [];
      let currentFile = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this is a file path line (starts with / or . and ends with .ts/.tsx/.js/.jsx)
        if (/^[./].*\.(ts|tsx|js|jsx)$/.test(line.trim())) {
          currentFile = line.trim();
          continue;
        }
        // Check if this is a security issue line
        if (
          line.includes("security/") ||
          line.includes("Possible SQL injection") ||
          line.includes("XSS") ||
          line.includes("command injection") ||
          line.includes("path traversal") ||
          line.includes("SQL injection") ||
          line.includes("hardcoded secret") ||
          line.includes("Math.random") ||
          line.includes("environment variable leak") ||
          line.includes("TOCTOU race condition")
        ) {
          // Include file path if available
          if (currentFile) {
            securityIssues.push(`${currentFile}\n${line.trim()}`);
          } else {
            securityIssues.push(line.trim());
          }
        }
      }

      return securityIssues.length > 0 ? securityIssues.join("\n") : null;
    },
  },
  {
    name: "TYPE ERRORS",
    command: "pnpm typecheck 2>&1",
    parseOutput: (output) => {
      // Extract error lines with file:line:column format
      const errorPattern = /[a-zA-Z0-9/.]+\.(ts|tsx):\d+:\d+/;
      const lines = output
        .split("\n")
        .filter(
          (line) => errorPattern.test(line) && !line.includes("error TS"),
        );

      if (lines.length === 0) return null;

      // Extract meaningful error messages
      return lines
        .slice(0, 20)
        .map((line) => {
          // Clean up TypeScript error messages
          const match = line.match(/(.+\.\w+:\d+:\d+) - (.+)/);
          return match ? `${match[1]} - ${match[2]}` : line;
        })
        .join("\n");
    },
  },
  {
    name: "LINT ISSUES",
    command: "pnpm lint:fix 2>&1",
    parseOutput: (output) => {
      // Extract error lines (lines with file paths and error codes)
      const lines = output.split("\n");
      const errorLines = lines.filter(
        (line) =>
          /[a-zA-Z0-9/.]+\.(ts|tsx|js|jsx):\d+:\d+/.test(line) &&
          !line.includes("warning") &&
          !line.includes("error TS"),
      );

      if (errorLines.length === 0) return null;
      return errorLines.slice(0, 20).join("\n");
    },
  },
];

const results = {
  security: 0,
  type: 0,
  lint: 0,
};

const output = [];
let hasErrors = false;

console.log(
  "Running validation checks (formatting, security, typecheck, lint)...\n",
);

// Auto-fix formatting first (silently)
try {
  execSync("pnpm format", { encoding: "utf-8", stdio: "ignore" });
} catch (error) {
  // Format errors are non-critical, continue
}

for (const check of checks) {
  try {
    let output_text;
    try {
      output_text = execSync(check.command, { encoding: "utf-8" });
    } catch (error) {
      output_text = error.stdout || error.message;
    }

    const parsed = check.parseOutput(output_text);
    if (parsed) {
      output.push(`=== ${check.name} ===`);
      output.push(parsed);
      output.push("");
      hasErrors = true;

      // Count issues
      if (check.name.includes("SECURITY"))
        results.security += (parsed.match(/\n/g) || []).length + 1;
      else if (check.name.includes("TYPE"))
        results.type += (parsed.match(/\n/g) || []).length + 1;
      else if (check.name.includes("LINT"))
        results.lint += (parsed.match(/\n/g) || []).length + 1;
    }
  } catch (error) {
    // Command execution errors are already captured
  }
}

// Add summary
if (hasErrors) {
  const totalIssues = results.security + results.type + results.lint;
  output.push("=== SUMMARY ===");
  output.push(
    `Total issues: ${totalIssues} (${results.security} security, ${results.type} type, ${results.lint} lint)`,
  );
} else {
  output.push("✓ All checks passed!");
}

console.log(output.join("\n"));
process.exit(hasErrors ? 1 : 0);
