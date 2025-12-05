#!/usr/bin/env node

/**
 * Shared GitHub helper utilities for CLI scripts
 *
 * Provides common functionality for scripts that interact with GitHub API:
 * - ANSI color output
 * - Command execution
 * - Rate limit checking
 * - Authentication verification
 */

import { execSync } from "child_process";

// Default repository (can be overridden by importing scripts)
export const DEFAULT_REPO = "AlignTrue/aligntrue";

// ANSI Colors for terminal output
export const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

/**
 * Execute a shell command and return the output
 * @param {string} cmd - Command to execute
 * @param {boolean} ignoreError - If true, return null on error instead of throwing
 * @returns {string|null} Command output or null if ignoreError is true and command fails
 */
export function runCommand(cmd, ignoreError = false) {
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

/**
 * Print a message with optional color
 * @param {string} msg - Message to print
 * @param {string} color - ANSI color code(s) to apply
 */
export function print(msg = "", color = "") {
  console.log(`${color}${msg}${COLORS.reset}`);
}

/**
 * Get GitHub API rate limit information
 * @returns {{ remaining: number, limit: number, reset: number } | null}
 */
export function getRateLimit() {
  try {
    const json = runCommand("gh api rate_limit");
    const data = JSON.parse(json);
    return data.resources.core;
  } catch {
    return null;
  }
}

/**
 * Check if GitHub CLI is authenticated
 * @returns {boolean} True if authenticated
 */
export function checkAuth() {
  try {
    runCommand("gh auth status");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check rate limit and display status, optionally exiting if too low
 * @param {number} minRequired - Minimum API calls required to proceed
 * @param {string} fallbackUrl - URL to show if rate limit is too low
 * @returns {boolean} True if rate limit is sufficient
 */
export function checkRateLimit(minRequired, fallbackUrl = "") {
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
      if (fallbackUrl) {
        print(
          "   To avoid blocking other tools, please check in the browser:",
          COLORS.yellow,
        );
        print(`   ${fallbackUrl}`, COLORS.blue);
      }
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

/**
 * Get the GitHub repository URL
 * @param {string} repo - Repository in "owner/repo" format
 * @returns {string} Full GitHub URL
 */
export function getRepoUrl(repo = DEFAULT_REPO) {
  return `https://github.com/${repo}`;
}

/**
 * Get the URL for a specific PR
 * @param {number} number - PR number
 * @param {string} repo - Repository in "owner/repo" format
 * @returns {string} Full PR URL
 */
export function getPRUrl(number, repo = DEFAULT_REPO) {
  return `${getRepoUrl(repo)}/pull/${number}`;
}

/**
 * Get the URL for a specific Actions run
 * @param {number} runId - Run ID
 * @param {string} repo - Repository in "owner/repo" format
 * @returns {string} Full run URL
 */
export function getRunUrl(runId, repo = DEFAULT_REPO) {
  return `${getRepoUrl(repo)}/actions/runs/${runId}`;
}

/**
 * Get the URL for the security/code-scanning page
 * @param {string} repo - Repository in "owner/repo" format
 * @returns {string} Full security URL
 */
export function getSecurityUrl(repo = DEFAULT_REPO) {
  return `${getRepoUrl(repo)}/security/code-scanning`;
}

/**
 * Get the current git branch name
 * @returns {string} Branch name or "main" if detection fails
 */
export function getCurrentBranch() {
  return runCommand("git rev-parse --abbrev-ref HEAD", true) || "main";
}

/**
 * Display authentication error and exit
 * @param {string} fallbackUrl - Optional URL to show for manual access
 */
export function exitAuthError(fallbackUrl = "") {
  print("Error: GitHub CLI not authenticated.", COLORS.red);
  print("   Run 'gh auth login' to authenticate.", COLORS.yellow);
  if (fallbackUrl) {
    print(`   Or check manually: ${fallbackUrl}`, COLORS.blue);
  }
  process.exit(1);
}

/**
 * Display rate limit error and exit
 * @param {string} fallbackUrl - URL to show for manual access
 */
export function exitRateLimitError(fallbackUrl) {
  print("\nRate limit too low to proceed safely.", COLORS.yellow);
  print(
    "   To avoid blocking other tools, please check in the browser:",
    COLORS.yellow,
  );
  print(`   ${fallbackUrl}`, COLORS.blue);
  process.exit(2);
}
