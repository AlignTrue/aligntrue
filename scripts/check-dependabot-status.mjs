#!/usr/bin/env node

/**
 * Dependabot Status Helper Script
 *
 * Purpose: List and optionally merge Dependabot PRs while respecting API rate limits.
 * Usage:
 *   node scripts/check-dependabot-status.mjs           # List all Dependabot PRs
 *   node scripts/check-dependabot-status.mjs --merge 42    # Merge PR #42
 *   node scripts/check-dependabot-status.mjs --merge-all   # Merge all passing PRs
 */

import { execSync } from "child_process";

// Configuration
const CONFIG = {
  REPO: "AlignTrue/aligntrue",
  MIN_RATE_LIMIT: 30, // Minimum API calls remaining to proceed
  MIN_RATE_LIMIT_MERGE: 50, // Higher threshold for merge operations
};

// ANSI Colors
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
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
    return data.resources.core;
  } catch {
    return null;
  }
}

function getRepoUrl() {
  return `https://github.com/${CONFIG.REPO}`;
}

function getPRUrl(number) {
  return `${getRepoUrl()}/pull/${number}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--merge-all")) {
    return { mode: "merge-all" };
  }
  const mergeIdx = args.indexOf("--merge");
  if (mergeIdx !== -1 && args[mergeIdx + 1]) {
    const prNumber = parseInt(args[mergeIdx + 1], 10);
    if (isNaN(prNumber)) {
      print("Error: --merge requires a valid PR number", COLORS.red);
      process.exit(1);
    }
    return { mode: "merge", prNumber };
  }
  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }
  return { mode: "list" };
}

function showHelp() {
  print("Dependabot Status Helper", COLORS.bold);
  print("");
  print("Usage:");
  print("  pnpm dependabot:status              List all Dependabot PRs");
  print("  pnpm dependabot:status --merge 42   Merge PR #42 (if CI passes)");
  print("  pnpm dependabot:status --merge-all  Merge all PRs with passing CI");
  print("  pnpm dependabot:status --help       Show this help");
  print("");
  print("Safety:");
  print("  - Only merges PRs from Dependabot");
  print("  - Only merges if CI checks pass");
  print("  - Skips PRs with merge conflicts");
  print("  - Uses squash merge for clean history");
}

function checkAuth() {
  try {
    runCommand("gh auth status");
    return true;
  } catch {
    print("Error: GitHub CLI not authenticated.", COLORS.red);
    print("   Run 'gh auth login' to authenticate.", COLORS.yellow);
    return false;
  }
}

function checkRateLimit(minRequired) {
  const rateLimit = getRateLimit();
  if (rateLimit) {
    const { remaining, limit, reset } = rateLimit;
    const resetDate = new Date(reset * 1000).toLocaleTimeString();

    print(
      `   API Rate Limit: ${remaining}/${limit} remaining (Resets at ${resetDate})`,
      COLORS.cyan,
    );

    if (remaining < minRequired) {
      print("\nWarning: Rate limit too low to proceed safely.", COLORS.yellow);
      print(
        "   To avoid blocking other tools, please check PRs in the browser:",
        COLORS.yellow,
      );
      print(
        `   ${getRepoUrl()}/pulls?q=author%3Aapp%2Fdependabot`,
        COLORS.blue,
      );
      return false;
    }
  } else {
    print(
      "Warning: Could not fetch rate limit info. Proceeding with caution...",
      COLORS.yellow,
    );
  }
  return true;
}

function fetchDependabotPRs() {
  const cmd = `gh pr list --repo ${CONFIG.REPO} --author "app/dependabot" --state open --json number,title,url,headRefName,mergeable,statusCheckRollup,createdAt`;
  const json = runCommand(cmd, true);
  if (!json) return [];
  return JSON.parse(json);
}

function getPRCheckStatus(pr) {
  // Check if statusCheckRollup exists and has items
  if (!pr.statusCheckRollup || pr.statusCheckRollup.length === 0) {
    return "pending";
  }

  const hasFailure = pr.statusCheckRollup.some(
    (check) =>
      check.conclusion === "FAILURE" ||
      check.conclusion === "ERROR" ||
      check.conclusion === "CANCELLED",
  );
  if (hasFailure) return "failure";

  const hasPending = pr.statusCheckRollup.some(
    (check) =>
      check.status === "IN_PROGRESS" ||
      check.status === "QUEUED" ||
      check.status === "PENDING" ||
      !check.conclusion,
  );
  if (hasPending) return "pending";

  return "success";
}

function categorizePRs(prs) {
  const ready = [];
  const failing = [];
  const pending = [];
  const conflicted = [];

  for (const pr of prs) {
    // Check for conflicts first
    if (pr.mergeable === "CONFLICTING") {
      conflicted.push(pr);
      continue;
    }

    const checkStatus = getPRCheckStatus(pr);
    if (checkStatus === "success") {
      ready.push(pr);
    } else if (checkStatus === "failure") {
      failing.push(pr);
    } else {
      pending.push(pr);
    }
  }

  return { ready, failing, pending, conflicted };
}

function displayPR(pr, prefix = "") {
  const checkStatus = getPRCheckStatus(pr);
  const statusIcon =
    checkStatus === "success" ? "✅" : checkStatus === "failure" ? "❌" : "⏳";
  const conflictNote = pr.mergeable === "CONFLICTING" ? " (CONFLICTS)" : "";

  print(`${prefix}${statusIcon} #${pr.number}: ${pr.title}${conflictNote}`);
  print(`${prefix}   Branch: ${pr.headRefName}`, COLORS.cyan);
  print(`${prefix}   Link: ${pr.url}`, COLORS.blue);
}

async function listPRs() {
  print("Checking Dependabot PRs...", COLORS.bold);

  if (!checkAuth()) {
    process.exit(1);
  }

  if (!checkRateLimit(CONFIG.MIN_RATE_LIMIT)) {
    process.exit(2);
  }

  print("");
  print("Fetching Dependabot PRs...", COLORS.bold);

  const prs = fetchDependabotPRs();

  if (prs.length === 0) {
    print("\nNo open Dependabot PRs found.", COLORS.green);
    return;
  }

  const { ready, failing, pending, conflicted } = categorizePRs(prs);

  print(`\nFound ${prs.length} open Dependabot PR(s):\n`, COLORS.bold);

  // Ready to merge
  if (ready.length > 0) {
    print(`Ready to merge (${ready.length}):`, COLORS.green + COLORS.bold);
    ready.forEach((pr) => displayPR(pr, "  "));
    print("");
  }

  // Pending CI
  if (pending.length > 0) {
    print(`CI in progress (${pending.length}):`, COLORS.yellow + COLORS.bold);
    pending.forEach((pr) => displayPR(pr, "  "));
    print("");
  }

  // Failing CI
  if (failing.length > 0) {
    print(`CI failing (${failing.length}):`, COLORS.red + COLORS.bold);
    failing.forEach((pr) => displayPR(pr, "  "));
    print("");
  }

  // Conflicted
  if (conflicted.length > 0) {
    print(
      `Has conflicts (${conflicted.length}):`,
      COLORS.magenta + COLORS.bold,
    );
    conflicted.forEach((pr) => displayPR(pr, "  "));
    print("");
  }

  // Suggestions
  print("---", COLORS.cyan);
  if (ready.length > 0) {
    print("Suggested actions:", COLORS.bold);
    if (ready.length === 1) {
      print(`  pnpm dependabot:status --merge ${ready[0].number}`, COLORS.cyan);
    } else {
      print(
        "  pnpm dependabot:status --merge-all   # Merge all passing PRs",
        COLORS.cyan,
      );
      print(
        `  pnpm dependabot:status --merge <num>  # Merge a specific PR`,
        COLORS.cyan,
      );
    }
  } else if (pending.length > 0) {
    print("CI is still running. Check back in a few minutes.", COLORS.yellow);
  } else if (failing.length > 0 || conflicted.length > 0) {
    print("All PRs need attention (failing CI or conflicts).", COLORS.yellow);
    print("Review each PR manually to resolve issues.", COLORS.yellow);
  }
}

async function mergePR(prNumber) {
  print(`Merging Dependabot PR #${prNumber}...`, COLORS.bold);

  if (!checkAuth()) {
    process.exit(1);
  }

  if (!checkRateLimit(CONFIG.MIN_RATE_LIMIT_MERGE)) {
    process.exit(2);
  }

  // Fetch the specific PR to verify it's from Dependabot
  const cmd = `gh pr view ${prNumber} --repo ${CONFIG.REPO} --json number,title,author,mergeable,statusCheckRollup`;
  let pr;
  try {
    const json = runCommand(cmd);
    pr = JSON.parse(json);
  } catch (e) {
    print(`\nError: Could not fetch PR #${prNumber}`, COLORS.red);
    print(`   ${e.message}`, COLORS.red);
    process.exit(1);
  }

  // Verify it's from Dependabot
  if (!pr.author || pr.author.login !== "dependabot") {
    print(`\nError: PR #${prNumber} is not from Dependabot.`, COLORS.red);
    print(`   Author: ${pr.author?.login || "unknown"}`, COLORS.yellow);
    print(
      "   This script only merges Dependabot PRs for safety.",
      COLORS.yellow,
    );
    process.exit(1);
  }

  // Check for conflicts
  if (pr.mergeable === "CONFLICTING") {
    print(`\nError: PR #${prNumber} has merge conflicts.`, COLORS.red);
    print(
      "   Resolve conflicts manually or close and let Dependabot recreate.",
      COLORS.yellow,
    );
    print(`   ${getPRUrl(prNumber)}`, COLORS.blue);
    process.exit(1);
  }

  // Check CI status
  const checkStatus = getPRCheckStatus(pr);
  if (checkStatus === "failure") {
    print(`\nError: PR #${prNumber} has failing CI checks.`, COLORS.red);
    print("   Review the failures before merging.", COLORS.yellow);
    print(`   ${getPRUrl(prNumber)}/checks`, COLORS.blue);
    process.exit(1);
  }

  if (checkStatus === "pending") {
    print(`\nError: PR #${prNumber} has pending CI checks.`, COLORS.yellow);
    print("   Wait for CI to complete before merging.", COLORS.yellow);
    print(`   ${getPRUrl(prNumber)}/checks`, COLORS.blue);
    process.exit(1);
  }

  // Merge the PR
  print(`\nMerging: ${pr.title}`, COLORS.cyan);
  try {
    runCommand(
      `gh pr merge ${prNumber} --repo ${CONFIG.REPO} --squash --delete-branch`,
    );
    print(`\nSuccessfully merged PR #${prNumber}!`, COLORS.green);
  } catch (e) {
    print(`\nError: Failed to merge PR #${prNumber}`, COLORS.red);
    print(`   ${e.message}`, COLORS.red);
    process.exit(1);
  }
}

async function mergeAll() {
  print("Merging all passing Dependabot PRs...", COLORS.bold);

  if (!checkAuth()) {
    process.exit(1);
  }

  if (!checkRateLimit(CONFIG.MIN_RATE_LIMIT_MERGE)) {
    process.exit(2);
  }

  print("");
  print("Fetching Dependabot PRs...", COLORS.bold);

  const prs = fetchDependabotPRs();

  if (prs.length === 0) {
    print("\nNo open Dependabot PRs found.", COLORS.green);
    return;
  }

  const { ready, failing, pending, conflicted } = categorizePRs(prs);

  if (ready.length === 0) {
    print("\nNo PRs are ready to merge.", COLORS.yellow);
    if (pending.length > 0) {
      print(`   ${pending.length} PR(s) have pending CI checks.`, COLORS.cyan);
    }
    if (failing.length > 0) {
      print(`   ${failing.length} PR(s) have failing CI checks.`, COLORS.cyan);
    }
    if (conflicted.length > 0) {
      print(`   ${conflicted.length} PR(s) have merge conflicts.`, COLORS.cyan);
    }
    return;
  }

  print(`\nFound ${ready.length} PR(s) ready to merge:`, COLORS.bold);
  ready.forEach((pr) => displayPR(pr, "  "));
  print("");

  // Merge each ready PR
  let merged = 0;
  let failed = 0;
  const errors = [];

  for (const pr of ready) {
    print(`Merging #${pr.number}: ${pr.title}...`, COLORS.cyan);
    try {
      runCommand(
        `gh pr merge ${pr.number} --repo ${CONFIG.REPO} --squash --delete-branch`,
      );
      print(`   Merged!`, COLORS.green);
      merged++;
    } catch (e) {
      print(`   Failed: ${e.message}`, COLORS.red);
      errors.push({ number: pr.number, error: e.message });
      failed++;
    }
  }

  // Summary
  print("");
  print("---", COLORS.cyan);
  print("Summary:", COLORS.bold);
  print(`   Merged: ${merged}`, COLORS.green);
  if (failed > 0) {
    print(`   Failed: ${failed}`, COLORS.red);
  }
  if (pending.length > 0) {
    print(`   Skipped (pending CI): ${pending.length}`, COLORS.yellow);
  }
  if (failing.length > 0) {
    print(`   Skipped (failing CI): ${failing.length}`, COLORS.yellow);
  }
  if (conflicted.length > 0) {
    print(`   Skipped (conflicts): ${conflicted.length}`, COLORS.yellow);
  }

  if (errors.length > 0) {
    print("\nErrors:", COLORS.red);
    errors.forEach(({ number, error }) => {
      print(`   #${number}: ${error}`, COLORS.red);
    });
  }

  if (merged > 0) {
    print(`\nSuccessfully merged ${merged} Dependabot PR(s)!`, COLORS.green);
  }
}

// Main
async function main() {
  const { mode, prNumber } = parseArgs();

  switch (mode) {
    case "help":
      showHelp();
      break;
    case "merge":
      await mergePR(prNumber);
      break;
    case "merge-all":
      await mergeAll();
      break;
    default:
      await listPRs();
  }
}

main();
