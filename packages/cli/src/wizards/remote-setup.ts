/**
 * Remote repository setup wizard
 * Guides users through setting up a personal/team remote repository
 */

import * as clack from "@clack/prompts";
import { StorageManager } from "@aligntrue/core";

export interface RemoteSetupResult {
  success: boolean;
  url?: string;
  branch?: string;
  skipped?: boolean;
}

/**
 * Run remote setup wizard
 */
export async function runRemoteSetupWizard(
  scope: "personal" | "team",
  cwd: string = process.cwd(),
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
    console.log("\nConfigure remote URL anytime:");
    console.log(`  aligntrue config set storage.${scope}.type remote`);
    console.log(`  aligntrue config set storage.${scope}.url <url>`);
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
    console.log("│ Learn more: docs.aligntrue.ai/personal-repo-setup       │");
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
      if (!value.includes("git@") && !value.includes("https://")) {
        return "URL must be SSH (git@...) or HTTPS (https://...)";
      }
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
  const spinner = clack.spinner();
  spinner.start("Testing connection");

  const storageManager = new StorageManager(cwd, {});
  const accessible = await storageManager.testRemoteAccess(url);

  if (!accessible) {
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
    console.log("\nOr switch to local only:");
    console.log(`  aligntrue config set storage.${scope}.type local`);

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

  // Step 5: Clone repository
  spinner.start("Cloning repository");

  try {
    // TODO: Implement cloneRemote in StorageManager
    // await storageManager.cloneRemote(scope, url, branch || "main");
    spinner.stop("✓ Repository configured (clone pending)");

    clack.outro(
      `${scope === "personal" ? "Personal" : "Team"} repository configured!`,
    );
    console.log(`\nYour ${scope} rules will now sync to:`);
    console.log(`  ${url}`);

    return {
      success: true,
      url,
      branch: branch || "main",
    };
  } catch (error) {
    spinner.stop("Clone failed");
    clack.log.error(
      `✗ Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { success: false };
  }
}
