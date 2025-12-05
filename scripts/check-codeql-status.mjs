#!/usr/bin/env node

/**
 * CodeQL Status Helper Script
 *
 * Purpose: Fetch GitHub code scanning alerts (CodeQL) via the GitHub API.
 * Usage: node scripts/check-codeql-status.mjs
 *
 * Respects API rate limits and provides actionable output.
 */

import {
  COLORS,
  runCommand,
  print,
  getRateLimit,
  checkAuth,
  getSecurityUrl,
  exitAuthError,
} from "./lib/github-helpers.mjs";

// Configuration
const CONFIG = {
  REPO: "AlignTrue/aligntrue",
  MIN_RATE_LIMIT: 30, // Minimum API calls remaining to proceed
};

// Main logic
async function main() {
  print("🔍 Checking CodeQL/code scanning status...", COLORS.bold);

  // 1. Check Authentication
  if (!checkAuth()) {
    exitAuthError(getSecurityUrl(CONFIG.REPO));
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
        "   To avoid blocking other tools, please check code scanning status in the browser:",
        COLORS.yellow,
      );
      print(`   👉 ${getSecurityUrl(CONFIG.REPO)}`, COLORS.blue);
      process.exit(2);
    }
  } else {
    print(
      "⚠️  Could not fetch rate limit info. Proceeding with caution...",
      COLORS.yellow,
    );
  }

  print("");

  // 3. Fetch CodeQL alerts
  print("🔄 Fetching code scanning alerts...", COLORS.bold);

  try {
    // Fetch code scanning alerts via GitHub REST API with actionable details
    const cmd = `gh api repos/${CONFIG.REPO}/code-scanning/alerts --paginate --jq '.[] | {number, state, rule: .rule.id, severity: .rule.security_severity_level, title: .rule.name, url: .url, file: .most_recent_instance.location.path, line: .most_recent_instance.location.start_line, endLine: .most_recent_instance.location.end_line, message: .most_recent_instance.message.text}'`;

    const json = runCommand(cmd);
    const alerts = json ? JSON.parse(`[${json.split("\n").join(",")}]`) : [];

    if (alerts.length === 0) {
      print(
        "✅ No code scanning alerts found! Repository is clean.",
        COLORS.green,
      );
      return;
    }

    // Group alerts by state
    const openAlerts = alerts.filter((a) => a.state === "open");
    const dismissedAlerts = alerts.filter((a) => a.state === "dismissed");

    // Display summary
    print(
      `📊 Total Alerts: ${alerts.length} (${openAlerts.length} open, ${dismissedAlerts.length} dismissed)`,
      COLORS.bold,
    );
    print("");

    if (openAlerts.length > 0) {
      print("🔴 Open Alerts:", COLORS.bold);
      openAlerts.forEach((alert, idx) => {
        const severityColor =
          alert.severity === "critical"
            ? COLORS.red
            : alert.severity === "high"
              ? COLORS.red
              : alert.severity === "medium"
                ? COLORS.yellow
                : COLORS.cyan;

        print(
          `   [${idx + 1}] #${alert.number}: ${alert.title} (${alert.rule})`,
          severityColor,
        );
        print(`       Severity: ${alert.severity || "unknown"}`);
        if (alert.file) {
          const lineRange =
            alert.endLine && alert.endLine !== alert.line
              ? `${alert.line}-${alert.endLine}`
              : alert.line;
          print(`       Location: ${alert.file}:${lineRange}`);
        }
        if (alert.message) {
          print(`       Issue: ${alert.message}`);
        }
        print(`       Link: ${alert.url}`, COLORS.blue);
      });
      print("");
    }

    if (dismissedAlerts.length > 0) {
      print(`📋 Dismissed Alerts (${dismissedAlerts.length}):`, COLORS.cyan);
      dismissedAlerts.slice(0, 3).forEach((alert) => {
        print(
          `   #${alert.number}: ${alert.title} (${alert.rule})`,
          COLORS.cyan,
        );
      });
      if (dismissedAlerts.length > 3) {
        print(
          `   ... and ${dismissedAlerts.length - 3} more dismissed alerts`,
          COLORS.cyan,
        );
      }
      print("");
    }

    // Recommendation
    if (openAlerts.length > 0) {
      const critical = openAlerts.filter(
        (a) => a.severity === "critical",
      ).length;
      const high = openAlerts.filter((a) => a.severity === "high").length;

      print("⚠️  Action Required:", COLORS.yellow);
      if (critical > 0) {
        print(
          `   ${critical} CRITICAL alert(s) need immediate attention!`,
          COLORS.red,
        );
      }
      if (high > 0) {
        print(`   ${high} HIGH severity alert(s) should be addressed soon.`);
      }
      print(
        `   Review all alerts here: ${getSecurityUrl(CONFIG.REPO)}`,
        COLORS.blue,
      );
    } else {
      print("✅ All alerts are dismissed or resolved.", COLORS.green);
    }
  } catch (e) {
    // Handle specific error cases
    if (e.message.includes("Could not resolve to a Repository")) {
      print("❌ Repository not found or not accessible.", COLORS.red);
      print("   Make sure you have access to the repository.", COLORS.yellow);
    } else if (
      e.message.includes("API rate limit") ||
      e.message.includes("403")
    ) {
      print("❌ API rate limit exceeded or access denied.", COLORS.red);
      print(
        `   Check status in browser: ${getSecurityUrl(CONFIG.REPO)}`,
        COLORS.blue,
      );
    } else {
      print("❌ Failed to fetch code scanning alerts.", COLORS.red);
      print(`Error: ${e.message}`, COLORS.red);
    }
    print("");
    print(`Please check manually: ${getSecurityUrl(CONFIG.REPO)}`, COLORS.blue);
    process.exit(1);
  }
}

main();
