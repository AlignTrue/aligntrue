#!/usr/bin/env node

import { execSync } from "child_process";

const checks = [
  {
    name: "SECURITY ISSUES",
    command: "pnpm lint --max-warnings 0 2>&1",
    parseOutput: (output) => {
      // Group security issues by rule type for better readability
      const lines = output.split("\n");
      const issuesByType = new Map();
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
          // Extract rule type (e.g., "security/detect-non-literal-fs-filename")
          const match = line.match(/security\/([^\s]+)/);
          const issueType = match ? match[1] : "other";

          if (!issuesByType.has(issueType)) {
            issuesByType.set(issueType, {
              count: 0,
              examples: [],
              files: new Set(),
            });
          }

          const issueData = issuesByType.get(issueType);
          issueData.count++;

          if (currentFile) {
            issueData.files.add(currentFile);
            // Keep first 5 examples per type
            if (issueData.examples.length < 5) {
              // Extract location and message from the line
              // Format: "  16:22  warning  Unsafe Regular Expression  security/detect-unsafe-regex"
              const lineMatch = line.match(
                /(\d+:\d+)\s+warning\s+(.+?)\s+security/,
              );
              if (lineMatch) {
                issueData.examples.push({
                  file: currentFile,
                  location: lineMatch[1],
                  message: lineMatch[2].trim(),
                });
              } else {
                // Fallback: use the whole line as message
                issueData.examples.push({
                  file: currentFile,
                  location: line.match(/(\d+:\d+)/)?.[1] || "",
                  message: line.trim(),
                });
              }
            }
          }
        }
      }

      if (issuesByType.size === 0) return null;

      // Sort by count (descending) and take top 12
      const sortedTypes = Array.from(issuesByType.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 12);

      // Format grouped output
      const sections = [];
      let totalIssuesShown = 0;
      let totalIssuesHidden = 0;
      let hiddenTypes = 0;

      for (let i = 0; i < sortedTypes.length; i++) {
        const [issueType, data] = sortedTypes[i];
        totalIssuesShown += data.count;

        const fileList = Array.from(data.files).slice(0, 10);
        sections.push(
          `${issueType}: ${data.count} occurrence${data.count > 1 ? "s" : ""} in ${data.files.size} file${data.files.size > 1 ? "s" : ""}`,
        );

        // Show examples
        if (data.examples.length > 0) {
          sections.push("  Examples:");
          data.examples.forEach((ex) => {
            sections.push(`    ${ex.file}:${ex.location} - ${ex.message}`);
          });
        }

        // Show affected files (limited)
        if (fileList.length > 0) {
          sections.push(`  Affected files (${data.files.size} total):`);
          fileList.forEach((file) => {
            sections.push(`    - ${file}`);
          });
          if (data.files.size > 10) {
            sections.push(`    ... and ${data.files.size - 10} more files`);
          }
        }
        sections.push("");
      }

      // Calculate hidden issues if there are more types
      if (issuesByType.size > 12) {
        const allSorted = Array.from(issuesByType.entries()).sort(
          (a, b) => b[1].count - a[1].count,
        );
        for (let i = 12; i < allSorted.length; i++) {
          const [, data] = allSorted[i];
          totalIssuesHidden += data.count;
          hiddenTypes++;
        }
        sections.push(
          `... and ${hiddenTypes} more rule type${hiddenTypes > 1 ? "s" : ""} with ${totalIssuesHidden} total issue${totalIssuesHidden > 1 ? "s" : ""}`,
        );
      }

      // Store total count in the result object for counting
      const totalCount = totalIssuesShown + totalIssuesHidden;
      const formattedOutput = sections.join("\n");

      // Attach count to the string (we'll extract it later)
      return { output: formattedOutput, count: totalCount };
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
      // Handle both string and object return types
      let parsedOutput;
      let issueCount = 0;

      if (typeof parsed === "object" && parsed.output) {
        // Security issues return { output, count }
        parsedOutput = parsed.output;
        issueCount = parsed.count;
      } else {
        // Other checks return string
        parsedOutput = parsed;
        issueCount = (parsed.match(/\n/g) || []).length + 1;
      }

      output.push(`=== ${check.name} ===`);
      output.push(parsedOutput);
      output.push("");
      hasErrors = true;

      // Count issues
      if (check.name.includes("SECURITY")) {
        results.security = issueCount;
      } else if (check.name.includes("TYPE")) {
        // Count actual error lines (filter out empty lines)
        const errorLines = parsedOutput
          .split("\n")
          .filter(
            (line) =>
              line.trim() && /[a-zA-Z0-9/.]+\.(ts|tsx):\d+:\d+/.test(line),
          );
        results.type = errorLines.length;
      } else if (check.name.includes("LINT")) {
        // Count actual error lines
        const errorLines = parsedOutput
          .split("\n")
          .filter(
            (line) =>
              line.trim() &&
              /[a-zA-Z0-9/.]+\.(ts|tsx|js|jsx):\d+:\d+/.test(line),
          );
        results.lint = errorLines.length;
      }
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
