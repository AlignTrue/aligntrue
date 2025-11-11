/**
 * Common error messages with actionable fixes
 */

import {
  createActionableError,
  type ActionableError,
} from "./error-formatter-v2.js";

/**
 * Error: Invalid storage in team mode (personal + repo)
 */
export function invalidStorageInTeamMode(
  sectionHeading: string,
): ActionableError {
  return createActionableError(
    "Invalid storage for personal rules",
    [
      `Section "${sectionHeading}" has:`,
      "• scope: personal",
      "• storage: repo",
      "",
      "This is not allowed in team mode.",
      "Personal rules cannot be in the shared repository.",
    ],
    [
      {
        command: "aligntrue migrate personal",
        description: "Move to personal remote (recommended)",
        impact:
          "• Move personal rules to your private repo\n   • Keep them version controlled\n   • Sync across your machines",
      },
      {
        command: `aligntrue local "${sectionHeading}"`,
        description: "Make local only",
        impact:
          "• Keep rule on this machine only\n   • Not backed up to any remote\n   • Never synced",
      },
      {
        command: `aligntrue promote "${sectionHeading}"`,
        description: "Promote to team rule",
        impact:
          "• Share rule with all team members\n   • Keep in main repository\n   • Require team approval for changes",
      },
    ],
    "https://docs.aligntrue.ai/team-mode-rules",
  );
}

/**
 * Error: Remote not accessible
 */
export function remoteNotAccessible(
  url: string,
  scope: string,
): ActionableError {
  return createActionableError(
    "Personal remote not accessible",
    [
      `${scope === "personal" ? "Personal" : "Team"} rules configured to use remote:`,
      url,
      "",
      "But repository is not accessible.",
      "",
      "Possible causes:",
      "• Repository doesn't exist",
      "• SSH key not configured",
      "• No write access",
    ],
    [
      {
        command: "ssh -T git@github.com",
        description: "Test SSH access",
        impact:
          'Expected: "Hi username! You\'ve successfully authenticated..."',
      },
      {
        command: "gh repo create aligntrue-rules --private",
        description: "Create repository (GitHub)",
        impact:
          "• Creates private repository\n   • Sets up access automatically",
      },
      {
        command: `aligntrue config set storage.${scope}.type local`,
        description: "Switch to local only",
        impact:
          "• Keep rules on this machine\n   • No remote sync\n   • No backup",
      },
    ],
    "https://docs.aligntrue.ai/troubleshooting/remote-access",
  );
}

/**
 * Error: Mode mismatch on restore
 */
export function modeMismatchOnRestore(
  currentMode: string,
  backupMode: string,
): ActionableError {
  return createActionableError(
    "Mode mismatch detected",
    [
      `Current mode: ${currentMode}`,
      `Backup mode: ${backupMode}`,
      "",
      "This backup contains rules from a different mode.",
      "Restoring may cause issues without migration.",
    ],
    [
      {
        command: "aligntrue revert --switch-mode",
        description: `Switch back to ${backupMode} mode`,
        impact: "• Restores backup as-is\n   • Changes mode automatically",
      },
      {
        command: "aligntrue revert --migrate",
        description: `Stay in ${currentMode} mode and migrate`,
        impact:
          "• Restores backup\n   • Runs migration wizard\n   • Adapts rules to current mode",
      },
    ],
    "https://docs.aligntrue.ai/backup-restore",
  );
}

/**
 * Error: Missing personal repo
 */
export function missingPersonalRepo(): ActionableError {
  return createActionableError(
    "Personal repository not configured",
    [
      "Personal rules are set to use remote storage,",
      "but no repository URL is configured.",
    ],
    [
      {
        command:
          "aligntrue config set storage.personal.url git@github.com:user/rules.git",
        description: "Configure personal repository",
        impact:
          "• Set remote URL\n   • Clone and sync automatically\n   • Backup personal rules",
      },
      {
        command: "aligntrue config set storage.personal.type local",
        description: "Switch to local only",
        impact:
          "• Keep rules on this machine\n   • No remote sync\n   • No backup",
      },
    ],
    "https://docs.aligntrue.ai/personal-repo-setup",
  );
}

/**
 * Error: Team section conflicts
 */
export function teamSectionConflict(
  sectionHeading: string,
  files: string[],
): ActionableError {
  return createActionableError(
    "Team section conflict detected",
    [
      `Section "${sectionHeading}" is team-managed`,
      "but has been edited in multiple files:",
      ...files.map((f) => `  • ${f}`),
      "",
      "Team-managed sections should only be edited by team leads.",
    ],
    [
      {
        command: "aligntrue sync --accept-team",
        description: "Accept team version",
        impact:
          "• Discard local changes\n   • Use team version\n   • Safe for team members",
      },
      {
        command: `aligntrue promote "${sectionHeading}"`,
        description: "Request promotion to team (if you're team lead)",
        impact:
          "• Create PR with changes\n   • Team lead reviews\n   • Merge if approved",
      },
      {
        command: `aligntrue demote "${sectionHeading}"`,
        description: "Convert to personal section",
        impact:
          "• Make section personal\n   • Keep your changes\n   • Won't affect team",
      },
    ],
    "https://docs.aligntrue.ai/team-mode-conflicts",
  );
}

/**
 * Error: Lockfile validation failed
 */
export function lockfileValidationFailed(
  currentHash: string,
  expectedHash: string,
): ActionableError {
  return createActionableError(
    "Lockfile validation failed",
    [
      "Bundle hash does not match lockfile:",
      `  Current: ${currentHash.slice(0, 16)}...`,
      `  Expected: ${expectedHash.slice(0, 16)}...`,
      "",
      "Rules have changed since last lock.",
    ],
    [
      {
        command: "aligntrue team approve --current",
        description: "Approve current bundle (team lead only)",
        impact:
          "• Add current hash to allow list\n   • Update lockfile\n   • Allow sync to proceed",
      },
      {
        command: "aligntrue sync --force",
        description: "Bypass validation (not recommended)",
        impact:
          "• Skip allow list check\n   • Sync anyway\n   • May violate team policy",
      },
      {
        command: "git revert HEAD",
        description: "Revert changes",
        impact:
          "• Undo rule changes\n   • Return to approved state\n   • Safe option",
      },
    ],
    "https://docs.aligntrue.ai/team-mode-approval",
  );
}

/**
 * Error: Git not installed
 */
export function gitNotInstalled(): ActionableError {
  return createActionableError(
    "Git not found",
    [
      "AlignTrue requires git for team mode features.",
      "Git is not installed or not in PATH.",
    ],
    [
      {
        command: "brew install git",
        description: "Install git (macOS)",
        impact: "• Install git via Homebrew\n   • Add to PATH automatically",
      },
      {
        command: "sudo apt-get install git",
        description: "Install git (Ubuntu/Debian)",
        impact: "• Install git via apt\n   • Add to PATH automatically",
      },
      {
        command: "aligntrue config set mode solo",
        description: "Switch to solo mode",
        impact:
          "• Disable team features\n   • No git required\n   • Local only",
      },
    ],
    "https://git-scm.com/downloads",
  );
}
