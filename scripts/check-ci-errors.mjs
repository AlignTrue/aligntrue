#!/usr/bin/env node

/**
 * CI Errors Helper Script
 *
 * Purpose: Fetch and display actual CI failure details from GitHub Actions.
 * Usage: node scripts/check-ci-errors.mjs
 *
 * Extracts test failures, assertion errors, and other actionable error information
 * from failed CI runs on the current branch.
 */

import { execSync } from "child_process";

// Configuration
const CONFIG = {
  REPO: "AlignTrue/aligntrue",
  MIN_RATE_LIMIT: 50, // Minimum API calls remaining to proceed
  RUN_LIMIT: 5, // Number of runs to check for failures
};

// ANSI Colors
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

// Helpers
function runCommand(cmd, ignoreError = false) {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (ignoreError) return null;
    throw error;
  }
}

function print(msg = "", color = "") {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function getRateLimit() {
  try {
    const json = runCommand("gh api rate_limit");
    const data = JSON.parse(json);
    return data.resources.core;
  } catch (e) {
    return null;
  }
}

function getCurrentBranch() {
  return runCommand("git rev-parse --abbrev-ref HEAD", true) || "main";
}

function getRepoUrl() {
  return `https://github.com/${CONFIG.REPO}`;
}

function getRunUrl(runId) {
  return `${getRepoUrl()}/actions/runs/${runId}`;
}

/**
 * Extract relevant error lines from CI log output
 * Looks for test failures, assertions, and error messages
 */
function parseErrors(logOutput) {
  const lines = logOutput.split("\n");
  const errors = [];
  let currentError = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match FAIL lines (test failures)
    if (line.includes(" FAIL ")) {
      if (currentError) {
        errors.push(currentError);
      }
      currentError = {
        type: "FAIL",
        lines: [line],
      };
    } else if (
      currentError &&
      (line.includes("AssertionError") ||
        line.includes("Error:") ||
        line.includes("Expected") ||
        line.includes("Received") ||
        line.includes(">") ||
        line.includes("at "))
    ) {
      // Collect context lines for the current error
      currentError.lines.push(line);
    } else if (currentError && line.trim() === "") {
      // Empty line might signal end of error block
      if (
        currentError.lines.some(
          (l) => l.includes("AssertionError") || l.includes("Error:"),
        )
      ) {
        errors.push(currentError);
        currentError = null;
      }
    }
  }

  // Don't forget the last error
  if (currentError) {
    errors.push(currentError);
  }

  return errors;
}

/**
 * Format error for display, limiting output length
 */
function formatError(error, index) {
  const lines = error.lines
    .map((l) => l.replace(/\x1b\[\d+m/g, "")) // Strip ANSI codes for cleaner display
    .filter((l) => l.trim())
    .slice(0, 5); // Limit to first 5 lines of context

  let output = `   Error #${index + 1}:\n`;
  lines.forEach((line) => {
    output += `      ${line.substring(0, 120)}\n`;
  });

  return output;
}

// Main logic
async function main() {
  print("🔍 Checking CI errors...", COLORS.bold);

  // 1. Check Authentication
  try {
    runCommand("gh auth status");
  } catch (e) {
    print("❌ GitHub CLI not authenticated.", COLORS.red);
    print("   Run 'gh auth login' to authenticate.", COLORS.yellow);
    process.exit(1);
  }

  // 2. Check Rate Limits
  const rateLimit = getRateLimit();
  if (rateLimit) {
    const { remaining, limit, reset } = rateLimit;
    const resetDate = new Date(reset * 1000).toLocaleTimeString();

    print(
      `   API Rate Limit: ${remaining}/${limit} remaining (Resets at ${resetDate})`,
      COLORS.cyan,
    );

    if (remaining < CONFIG.MIN_RATE_LIMIT) {
      print("\n⚠️  Rate limit too low to proceed safely.", COLORS.yellow);
      print("   Please try again after the limit resets.", COLORS.yellow);
      process.exit(2);
    }
  } else {
    print(
      "⚠️  Could not fetch rate limit info. Proceeding with caution...",
      COLORS.yellow,
    );
  }

  // 3. Get Context
  const branch = getCurrentBranch();
  print(`   Branch: ${branch}`, COLORS.cyan);
  print("");

  // 4. Fetch and analyze runs
  print("🔄 Fetching recent CI runs...", COLORS.bold);

  try {
    // Fetch runs for current branch
    const cmd = `gh run list --repo ${CONFIG.REPO} --branch ${branch} --limit ${CONFIG.RUN_LIMIT} --json databaseId,status,conclusion,url,headSha,createdAt,name,event`;
    const json = runCommand(cmd);
    const runs = JSON.parse(json);

    if (runs.length === 0) {
      print(`No CI runs found for branch '${branch}'.`, COLORS.yellow);
      process.exit(0);
    }

    // Find the most recent failed CI run
    const ciRuns = runs.filter((r) => r.name === "CI");
    const failedRun = ciRuns.find((r) => r.conclusion === "failure");

    if (!failedRun) {
      print("✅ No failed CI runs found on this branch.", COLORS.green);
      const latestRun = ciRuns[0] || runs[0];
      if (latestRun.status === "completed") {
        print(
          `   Latest run: ${latestRun.conclusion === "success" ? "✅ Success" : "⚪ " + latestRun.conclusion}`,
        );
      } else {
        print("   CI is currently running. Check back shortly.");
      }
      process.exit(0);
    }

    // Display failed run info
    const time = new Date(failedRun.createdAt).toLocaleString();
    const shortSha = failedRun.headSha.substring(0, 7);

    print("❌ Latest failed run:", COLORS.bold);
    print(
      `   Run #${failedRun.databaseId} (${failedRun.name}) - ${failedRun.event}`,
      COLORS.red,
    );
    print(`   Commit: ${shortSha} | Time: ${time}`);
    print("");

    // 5. Fetch failed logs
    print("📋 Fetching error details...", COLORS.bold);

    const logCmd = `gh run view ${failedRun.databaseId} --log-failed 2>&1`;
    const logs = runCommand(logCmd, true);

    if (!logs) {
      print("⚠️  Could not fetch logs. View online:", COLORS.yellow);
      print(`   ${getRunUrl(failedRun.databaseId)}`, COLORS.blue);
      process.exit(1);
    }

    // Parse errors from logs
    const errors = parseErrors(logs);

    if (errors.length === 0) {
      print("⚠️  No structured errors found in logs.", COLORS.yellow);
      print("   Check the full logs online:", COLORS.yellow);
      print(`   ${getRunUrl(failedRun.databaseId)}`, COLORS.blue);
      process.exit(0);
    }

    // Display errors
    print("");
    print(`Found ${errors.length} error(s):`, COLORS.bold);
    print("");

    errors.forEach((error, idx) => {
      print(formatError(error, idx), COLORS.red);
    });

    // Summary
    print("View full logs:", COLORS.blue);
    print(`   ${getRunUrl(failedRun.databaseId)}`, COLORS.blue);
  } catch (e) {
    print("❌ Failed to fetch CI errors.", COLORS.red);
    print(`Error: ${e.message}`, COLORS.red);
    process.exit(1);
  }
}

main();
