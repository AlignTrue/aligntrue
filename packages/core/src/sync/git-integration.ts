/**
 * Git integration for managing generated files
 * Supports three modes: ignore, commit, branch
 *
 * Usage:
 * - Used by SyncWorkflow to manage visibility of generated agent files
 * - 'ignore': Adds generated files to .gitignore (default for personal/local rules)
 * - 'commit': Ensures files are NOT in .gitignore (for team/shared rules)
 * - 'branch': Creates a feature branch and stages files (for PR workflows)
 *
 * Configuration:
 * - Controlled by `git.mode` and `git.auto_gitignore` in .aligntrue/config.yaml
 * - Can be overridden per-exporter using `git.overrides`
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join, relative, isAbsolute } from "path";
import { execFileSync } from "child_process";

export type GitMode = "ignore" | "commit" | "branch";

export interface GitIntegrationOptions {
  mode: GitMode;
  workspaceRoot: string;
  generatedFiles: string[];
  perExporterOverrides?: Record<string, GitMode>;
  branchName?: string;
}

export interface GitModeResult {
  mode: GitMode;
  action: string;
  filesAffected: string[];
  branchCreated?: string;
}

export class GitIntegration {
  /**
   * Apply git integration based on mode
   */
  async apply(options: GitIntegrationOptions): Promise<GitModeResult> {
    const { mode, generatedFiles, perExporterOverrides } = options;

    // Group files by effective mode (considering per-exporter overrides)
    const filesByMode = this.groupFilesByMode(
      generatedFiles,
      mode,
      perExporterOverrides,
    );

    const results: GitModeResult[] = [];

    // Apply each mode
    for (const [effectiveMode, files] of Object.entries(filesByMode)) {
      if (files.length === 0) continue;

      switch (effectiveMode as GitMode) {
        case "ignore":
          results.push(
            await this.applyIgnoreMode(options.workspaceRoot, files),
          );
          break;
        case "commit":
          results.push(
            await this.applyCommitMode(options.workspaceRoot, files),
          );
          break;
        case "branch":
          results.push(
            await this.applyBranchMode(
              options.workspaceRoot,
              files,
              options.branchName,
            ),
          );
          break;
      }
    }

    // Return primary mode result
    return (
      results[0] || {
        mode,
        action: "no files to process",
        filesAffected: [],
      }
    );
  }

  /**
   * Group files by effective mode considering per-exporter overrides
   */
  private groupFilesByMode(
    files: string[],
    defaultMode: GitMode,
    overrides?: Record<string, GitMode>,
  ): Record<GitMode, string[]> {
    const grouped: Record<GitMode, string[]> = {
      ignore: [],
      commit: [],
      branch: [],
    };

    for (const file of files) {
      // Determine exporter from file path
      const exporter = this.inferExporterFromPath(file);
      const effectiveMode =
        (overrides && exporter && overrides[exporter]) || defaultMode;
      grouped[effectiveMode].push(file);
    }

    return grouped;
  }

  /**
   * Infer exporter name from file path
   */
  private inferExporterFromPath(filePath: string): string | null {
    if (filePath.includes(".cursor/")) return "cursor";
    if (filePath === "AGENTS.md") return "agents";
    if (filePath.includes(".vscode/mcp.json")) return "vscode-mcp";
    if (filePath.includes(".amazonq/")) return "amazonq";
    if (filePath.includes(".windsurf/")) return "windsurf";
    // Add more as needed
    return null;
  }

  /**
   * Apply ignore mode: add files to .gitignore
   */
  private async applyIgnoreMode(
    workspaceRoot: string,
    files: string[],
  ): Promise<GitModeResult> {
    const gitignorePath = join(workspaceRoot, ".gitignore");

    // Normalize paths to relative (exporters may return absolute paths)
    const normalizedFiles = this.normalizePathsForGitignore(
      workspaceRoot,
      files,
    );

    for (const file of normalizedFiles) {
      await this.ensureGitignoreEntry(gitignorePath, file);
    }

    return {
      mode: "ignore",
      action: "added to .gitignore",
      filesAffected: normalizedFiles,
    };
  }

  /**
   * Apply commit mode: stage files for commit
   */
  private async applyCommitMode(
    workspaceRoot: string,
    files: string[],
  ): Promise<GitModeResult> {
    // Check if workspace is a git repo
    if (!this.isGitRepo(workspaceRoot)) {
      throw new Error(
        "Git commit mode requires a git repository. Initialize git first: git init",
      );
    }

    // Normalize paths (absolute to relative, backslashes to forward slashes)
    const normalizedFiles = this.normalizePathsForGitignore(
      workspaceRoot,
      files,
    );

    // Stage the generated files
    const stagedFiles: string[] = [];
    for (const file of normalizedFiles) {
      const fullPath = join(workspaceRoot, file);
      if (existsSync(fullPath)) {
        execFileSync("git", ["add", file], {
          cwd: workspaceRoot,
          stdio: "pipe",
        });
        stagedFiles.push(file);
      }
    }

    return {
      mode: "commit",
      action: "staged files for commit",
      filesAffected: stagedFiles,
    };
  }

  /**
   * Get the current git branch name
   */
  private getCurrentBranch(workspaceRoot: string): string | null {
    try {
      const branch = execFileSync(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        {
          cwd: workspaceRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      ).trim();
      return branch || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the repository has at least one commit
   */
  private hasInitialCommit(workspaceRoot: string): boolean {
    try {
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: workspaceRoot,
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply branch mode: create feature branch and stage files
   * If already on an aligntrue/sync-* branch, reuse it instead of creating a new one
   */
  private async applyBranchMode(
    workspaceRoot: string,
    files: string[],
    branchName?: string,
  ): Promise<GitModeResult> {
    // Check if workspace is a git repo
    if (!this.isGitRepo(workspaceRoot)) {
      throw new Error(
        "Git branch mode requires a git repository. Initialize git first: git init",
      );
    }

    // Ensure repository has an initial commit; branch creation fails otherwise.
    if (!this.hasInitialCommit(workspaceRoot)) {
      execFileSync("git", ["commit", "--allow-empty", "-m", "Initial commit"], {
        cwd: workspaceRoot,
        stdio: "pipe",
      });
    }

    // Normalize paths (absolute to relative, backslashes to forward slashes)
    const normalizedFiles = this.normalizePathsForGitignore(
      workspaceRoot,
      files,
    );

    // Check if already on an aligntrue/sync branch
    const currentBranch = this.getCurrentBranch(workspaceRoot);
    const isOnSyncBranch =
      currentBranch && currentBranch.startsWith("aligntrue/sync-");

    let branch: string;
    let branchCreated = false;

    if (isOnSyncBranch && !branchName) {
      // Reuse existing sync branch
      branch = currentBranch;
    } else {
      // Generate branch name with full timestamp including milliseconds for uniqueness
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 23); // Include milliseconds: 2025-12-05T20-10-15-123
      branch = branchName || `aligntrue/sync-${timestamp}`;

      try {
        // Create and checkout new branch
        execFileSync("git", ["checkout", "-b", branch], {
          cwd: workspaceRoot,
          stdio: "pipe",
        });
        branchCreated = true;
      } catch (_error) {
        const message =
          _error instanceof Error ? _error.message : String(_error);
        throw new Error(`Failed to create git branch: ${message}`);
      }
    }

    // Stage the generated files
    const stagedFiles: string[] = [];
    for (const file of normalizedFiles) {
      const fullPath = join(workspaceRoot, file);
      if (existsSync(fullPath)) {
        execFileSync("git", ["add", file], {
          cwd: workspaceRoot,
          stdio: "pipe",
        });
        stagedFiles.push(file);
      }
    }

    return {
      mode: "branch",
      action: branchCreated
        ? "created branch and staged files"
        : "staged files on existing branch",
      filesAffected: stagedFiles,
      ...(branchCreated ? { branchCreated: branch } : {}),
    };
  }

  /**
   * Update .gitignore with managed section for AlignTrue files
   *
   * @param workspaceRoot - Workspace root directory
   * @param files - Files to add/remove from .gitignore
   * @param autoMode - Auto-gitignore mode (auto, always, never)
   * @param gitMode - Current git mode (ignore, commit, branch)
   */
  async updateGitignore(
    workspaceRoot: string,
    files: string[],
    autoMode: "auto" | "always" | "never",
    gitMode: GitMode,
  ): Promise<void> {
    if (autoMode === "never") {
      return;
    }

    const gitignorePath = join(workspaceRoot, ".gitignore");
    const marker = "# START AlignTrue Generated Files";
    const endMarker = "# END AlignTrue Generated Files";

    let content = "";
    try {
      content = readFileSync(gitignorePath, "utf-8");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error; // re-throw other errors
      }
      // File doesn't exist, content remains ""
    }

    // When git mode is "commit" or "branch", remove files from .gitignore
    // (they should be tracked by git, not ignored)
    if (gitMode === "commit" || gitMode === "branch") {
      // Remove the managed section entirely so files can be committed
      const updatedContent = this.removeManagedSection(
        content,
        marker,
        endMarker,
      );
      if (updatedContent !== content) {
        writeFileSync(gitignorePath, updatedContent, "utf-8");
      }
      return;
    }

    // In "ignore" mode (or "auto" with ignore): add files to .gitignore
    // Normalize paths to relative (exporters may return absolute paths)
    const relativePaths = this.normalizePathsForGitignore(workspaceRoot, files);

    // Always include unified backups directory in the patterns
    const allPatterns = [".aligntrue/.backups/", ...relativePaths];
    content = this.addManagedSection(content, marker, endMarker, allPatterns);
    writeFileSync(gitignorePath, content, "utf-8");
  }

  /**
   * Add gitignored rules to .gitignore with separate managed section
   *
   * @param workspaceRoot - Workspace root directory
   * @param files - Rule files to add (source paths in .aligntrue/rules/)
   */
  async addGitignoreRulesToGitignore(
    workspaceRoot: string,
    files: string[],
  ): Promise<void> {
    const gitignorePath = join(workspaceRoot, ".gitignore");
    const marker = "# START AlignTrue Gitignored Rules";
    const endMarker = "# END AlignTrue Gitignored Rules";
    // Legacy markers for backward compatibility
    const legacyMarker = "# START AlignTrue Private Rules";
    const legacyEndMarker = "# END AlignTrue Private Rules";

    let content = "";
    try {
      content = readFileSync(gitignorePath, "utf-8");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
      // File doesn't exist, content remains ""
    }

    // Remove legacy section if present (migrate to new naming)
    content = this.removeManagedSection(content, legacyMarker, legacyEndMarker);

    // Normalize paths to relative
    const relativePaths = this.normalizePathsForGitignore(workspaceRoot, files);

    content = this.addManagedSection(content, marker, endMarker, relativePaths);
    writeFileSync(gitignorePath, content, "utf-8");
  }

  /**
   * Remove a managed section from content
   */
  private removeManagedSection(
    content: string,
    marker: string,
    endMarker: string,
  ): string {
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
    const escapedEndMarker = endMarker.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
    const regex = new RegExp(
      `${escapedMarker}[\\s\\S]*?${escapedEndMarker}\\n?`,
      "g",
    );
    return content.replace(regex, "");
  }

  /**
   * Add or update managed section in .gitignore
   */
  private addManagedSection(
    content: string,
    marker: string,
    endMarker: string,
    files: string[],
  ): string {
    // Remove existing managed section if present
    // Escape markers for safe regex construction (markers are hardcoded constants, not user input)
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
    const escapedEndMarker = endMarker.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

    // Safe: Markers are hardcoded constants (lines 234-235), escaped for regex safety
    const regex = new RegExp(
      `${escapedMarker}[\\s\\S]*?${escapedEndMarker}\\n?`,
      "g",
    );
    content = content.replace(regex, "");

    // Sort files and format
    const sortedFiles = [...new Set(files)].sort();
    const section = [marker, ...sortedFiles, endMarker, ""].join("\n");

    // Append to end
    return content.trimEnd() + "\n\n" + section;
  }

  /**
   * Ensure a pattern exists in .gitignore (idempotent)
   */
  private async ensureGitignoreEntry(
    gitignorePath: string,
    pattern: string,
  ): Promise<void> {
    // Normalize pattern (remove leading ./)
    const normalizedPattern = pattern.replace(/^\.\//, "");

    try {
      // Attempt to create the file atomically with the first entry
      writeFileSync(
        gitignorePath,
        `# AlignTrue generated files\n${normalizedPattern}\n`,
        { encoding: "utf-8", flag: "wx" },
      );
      return; // Success, file created.
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "EEXIST"
      ) {
        throw error; // Rethrow unexpected errors
      }
      // File already exists, proceed to read and append logic
    }

    // Check if pattern already exists
    const content = readFileSync(gitignorePath, "utf-8");
    const lines = content.split("\n");

    if (lines.some((line) => line.trim() === normalizedPattern)) {
      // Already exists, skip
      return;
    }

    // Append to .gitignore
    const hasTrailingNewline = content.endsWith("\n");
    const prefix = hasTrailingNewline ? "" : "\n";
    appendFileSync(
      gitignorePath,
      `${prefix}# AlignTrue generated\n${normalizedPattern}\n`,
      "utf-8",
    );
  }

  /**
   * Normalize file paths for .gitignore entries
   * - Converts absolute paths within workspace to relative
   * - Normalizes backslashes to forward slashes
   * - Handles edge case where absolute path shares prefix but is outside workspace
   */
  private normalizePathsForGitignore(
    workspaceRoot: string,
    files: string[],
  ): string[] {
    return files.map((f) => {
      // Only convert absolute paths; relative paths just need slash normalization
      if (isAbsolute(f)) {
        const rel = relative(workspaceRoot, f);
        // If relative path doesn't escape workspace (no leading ..) and isn't absolute,
        // it's truly within workspace - use the relative version
        if (!rel.startsWith("..") && !isAbsolute(rel)) {
          return rel.replace(/\\/g, "/");
        }
        // Absolute path outside workspace - keep as-is but normalize slashes
        return f.replace(/\\/g, "/");
      }
      // Already relative, just normalize slashes
      return f.replace(/\\/g, "/");
    });
  }

  /**
   * Check if directory is a git repository
   */
  private isGitRepo(workspaceRoot: string): boolean {
    const gitDir = join(workspaceRoot, ".git");
    return existsSync(gitDir);
  }
}
