#!/usr/bin/env node

/**
 * CI Status Helper Script
 *
 * Purpose: Efficiently check GitHub Actions CI status while respecting API rate limits.
 * Usage: node scripts/check-ci-status.mjs
 */

import { execSync } from "child_process";

// Configuration
const CONFIG = {
  REPO: "AlignTrue/aligntrue",
  MIN_RATE_LIMIT: 50, // Minimum API calls remaining to proceed
  RUN_LIMIT: 3, // Number of runs to fetch
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
    // Check core rate limit (most restrictive for general API calls)
    return data.resources.core;
  } catch (e) {
    // If gh api fails, we might not be auth'd or have network issues
    return null;
  }
}

function getCurrentBranch() {
  return runCommand("git rev-parse --abbrev-ref HEAD", true) || "main";
}

function getRepoUrl() {
  return `https://github.com/${CONFIG.REPO}`;
}

function getActionsUrl() {
  return `${getRepoUrl()}/actions`;
}

// Main logic
async function main() {
  print("🔍 Checking CI status context...", COLORS.bold);

  // 1. Check Authentication
  try {
    runCommand("gh auth status");
  } catch (e) {
    print("❌ GitHub CLI not authenticated.", COLORS.red);
    print("   Run 'gh auth login' to authenticate.", COLORS.yellow);
    print(`   Or view CI status on web: ${getActionsUrl()}`, COLORS.blue);
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
      print(
        "   To avoid blocking other tools, please check CI status in the browser:",
        COLORS.yellow,
      );
      print(`   👉 ${getActionsUrl()}`, COLORS.blue);
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

  // 4. Fetch Runs
  print("🔄 Fetching latest CI runs...", COLORS.bold);

  try {
    // Fetch runs for current branch
    const cmd = `gh run list --repo ${CONFIG.REPO} --branch ${branch} --limit ${CONFIG.RUN_LIMIT} --json databaseId,status,conclusion,url,headSha,createdAt,name,event`;
    const json = runCommand(cmd);
    const runs = JSON.parse(json);

    if (runs.length === 0) {
      print(`No CI runs found for branch '${branch}'.`, COLORS.yellow);
      print(`Check all runs here: ${getActionsUrl()}`, COLORS.blue);
      return;
    }

    // Display runs
    runs.forEach((run) => {
      const statusIcon =
        run.status === "completed"
          ? run.conclusion === "success"
            ? "✅"
            : run.conclusion === "failure"
              ? "❌"
              : "⚪"
          : "⏳";

      const time = new Date(run.createdAt).toLocaleString();
      const shortSha = run.headSha.substring(0, 7);

      print(
        `${statusIcon} [${run.databaseId}] ${run.name} (${run.event})`,
        COLORS.bold,
      );
      print(
        `   Status: ${run.status} ${run.conclusion ? `(${run.conclusion})` : ""}`,
      );
      print(`   Commit: ${shortSha} | Time: ${time}`);
      print(`   Link:   ${run.url}`, COLORS.blue);
      print("");
    });

    // 5. Recommendation
    // Find the most recent CI run (not CodeQL or other auxiliary workflows)
    const ciRuns = runs.filter((r) => r.name === "CI");
    const latest = ciRuns.length > 0 ? ciRuns[0] : runs[0];

    if (latest.status !== "completed") {
      print(
        "ℹ️  CI is still running. You can watch it live with:",
        COLORS.yellow,
      );
      print(`   gh run watch ${latest.databaseId}`, COLORS.cyan);
    } else if (latest.conclusion === "failure") {
      print("❌ Latest CI run failed.", COLORS.red);
      print("   To view failure details efficiently:", COLORS.yellow);
      print(`   gh run view ${latest.databaseId} --log-failed`, COLORS.cyan);
    } else {
      print("✅ Latest CI run passed.", COLORS.green);
    }
  } catch (e) {
    print("❌ Failed to fetch CI runs.", COLORS.red);
    print(`Error: ${e.message}`, COLORS.red);
    print("");
    print(`Please check manually: ${getActionsUrl()}`, COLORS.blue);
    process.exit(1);
  }
}

main();
