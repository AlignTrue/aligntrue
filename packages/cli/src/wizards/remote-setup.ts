/**
 * Remote repository setup wizard
 * Guides users through setting up a remote repository for backup
 */

import { execFileSync } from "child_process";
import * as clack from "@clack/prompts";
import { DOCS_REMOTE_SETUP } from "../constants.js";
import { createManagedSpinner } from "../utils/spinner.js";

export interface RemoteSetupResult {
  success: boolean;
  url?: string;
  branch?: string;
  skipped?: boolean;
}

/**
 * Test if a git remote URL is accessible
 */
async function testRemoteAccess(
  url: string,
): Promise<{ accessible: boolean; error?: string }> {
  try {
    // Validate URL format
    if (url.startsWith("https://")) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          return { accessible: false, error: "Invalid HTTPS URL" };
        }
      } catch {
        return { accessible: false, error: "Invalid HTTPS URL format" };
      }

      // Test HTTPS with git ls-remote
      try {
        execFileSync("git", ["ls-remote", url, "HEAD"], {
          timeout: 10000,
          stdio: "pipe",
        });
        return { accessible: true };
      } catch (err) {
        return {
          accessible: false,
          error: `HTTPS connection failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Validate git@ SSH URLs
    if (url.startsWith("git@")) {
      if (!/^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9/_.-]+$/.test(url)) {
        return { accessible: false, error: "Invalid git@ SSH URL format" };
      }

      // Test SSH with git ls-remote
      try {
        execFileSync("git", ["ls-remote", url, "HEAD"], {
          timeout: 10000,
          stdio: "pipe",
        });
        return { accessible: true };
      } catch (err) {
        return {
          accessible: false,
          error: `SSH connection failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      accessible: false,
      error: "URL must be SSH (git@...) or HTTPS (https://...)",
    };
  } catch (err) {
    return {
      accessible: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run remote setup wizard
 */
export async function runRemoteSetupWizard(
  scope: "personal" | "team",
  _cwd: string = process.cwd(),
): Promise<RemoteSetupResult> {
  clack.intro(`${scope === "personal" ? "Personal" : "Team"} Repository Setup`);

  // Step 1: Check if user has a repo
  const hasRepo = await clack.select({
    message: `You'll need a private git repository for your ${scope} rules.`,
    options: [
      {
        value: "have",
        label: "I already have a repository",
        hint: "Enter URL now",
      },
      {
        value: "create",
        label: "Create repository now (guided)",
        hint: "Opens setup guide",
      },
      {
        value: "later",
        label: "Set up later (stay local for now)",
        hint: `${scope === "personal" ? "Personal" : "Team"} rules will stay local`,
      },
    ],
  });

  if (clack.isCancel(hasRepo)) {
    clack.cancel("Setup cancelled");
    return { success: false };
  }

  if (hasRepo === "later") {
    clack.outro(
      `${scope === "personal" ? "Personal" : "Team"} rules will stay local.`,
    );
    console.log(
      "\nTo add a remote backup later, configure remote_backup in .aligntrue/config.yaml",
    );
    return { success: true, skipped: true };
  }

  if (hasRepo === "create") {
    // Show setup guide
    console.log(
      "\n┌─────────────────────────────────────────────────────────┐",
    );
    console.log("│ Repository Setup Guide                                  │");
    console.log("│                                                         │");
    console.log("│ Quick Setup (5 minutes):                                │");
    console.log("│                                                         │");
    console.log("│ 1. Create private repository                            │");
    console.log("│    • GitHub: github.com/new                             │");
    console.log("│    • GitLab: gitlab.com/projects/new                    │");
    console.log("│    • Bitbucket: bitbucket.org/repo/create               │");
    console.log("│                                                         │");
    console.log("│ 2. Name it (suggestion: 'aligntrue-rules')              │");
    console.log("│    • Keep it private                                    │");
    console.log("│    • Don't initialize with README                       │");
    console.log("│                                                         │");
    console.log("│ 3. Copy the SSH URL                                     │");
    console.log("│    • Format: git@github.com:user/repo.git               │");
    console.log("│                                                         │");
    console.log("│ 4. Ensure SSH access                                    │");
    console.log("│    • Test: ssh -T git@github.com                        │");
    console.log("│    • Setup keys: docs.github.com/ssh                    │");
    console.log("│                                                         │");
    console.log("│ 5. Return here and enter URL                            │");
    console.log("│                                                         │");
    console.log(
      `│ Learn more: ${DOCS_REMOTE_SETUP.replace("https://", "").padEnd(50)}│`,
    );
    console.log(
      "└─────────────────────────────────────────────────────────┘\n",
    );

    const ready = await clack.confirm({
      message: "Press Enter when ready to continue...",
      initialValue: true,
    });

    if (clack.isCancel(ready) || !ready) {
      clack.cancel("Setup cancelled");
      return { success: false };
    }
  }

  // Step 2: Get repository URL
  const url = await clack.text({
    message: "Enter repository URL (or 'skip' to stay local):",
    placeholder: "git@github.com:user/aligntrue-rules.git",
    validate: (value) => {
      if (value === "skip") return;
      if (!value) return "URL is required";

      // Validate HTTPS URLs using URL constructor
      if (value.startsWith("https://")) {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== "https:") {
            return "HTTPS URL protocol must be https://";
          }
          return;
        } catch {
          return "Invalid HTTPS URL format";
        }
      }

      // Validate git@ SSH URLs
      if (value.startsWith("git@")) {
        if (!/^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9/_.-]+$/.test(value)) {
          return "Invalid git@ SSH URL format (expected: git@host:path/to/repo)";
        }
        return;
      }

      return "URL must be SSH (git@...) or HTTPS (https://...)";
    },
  });

  if (clack.isCancel(url)) {
    clack.cancel("Setup cancelled");
    return { success: false };
  }

  if (url === "skip") {
    clack.outro(
      `${scope === "personal" ? "Personal" : "Team"} rules will stay local.`,
    );
    return { success: true, skipped: true };
  }

  // Step 3: Test connection
  const spinner = createManagedSpinner();
  spinner.start("Testing connection");

  const result = await testRemoteAccess(url);

  if (!result.accessible) {
    spinner.stop("Connection failed");
    clack.log.error("✗ Repository not accessible");
    console.log("\nPossible causes:");
    console.log("  • Repository doesn't exist");
    console.log("  • SSH key not configured");
    console.log("  • No write access");
    console.log("\nFix:");
    console.log("  1. Test SSH access: ssh -T git@github.com");
    console.log("  2. Setup SSH key: docs.github.com/ssh");
    console.log(
      "  3. Create repository: gh repo create aligntrue-rules --private",
    );

    return { success: false };
  }

  spinner.stop("✓ Repository accessible");

  // Step 4: Get branch (optional)
  const branch = await clack.text({
    message: "Branch name (optional):",
    placeholder: "main",
    initialValue: "main",
  });

  if (clack.isCancel(branch)) {
    clack.cancel("Setup cancelled");
    return { success: false };
  }

  clack.outro(
    `Repository verified!\n\nAdd to your .aligntrue/config.yaml:\n\nremote_backup:\n  default:\n    url: ${url}\n    branch: ${branch || "main"}`,
  );

  return {
    success: true,
    url,
    branch: branch || "main",
  };
}
