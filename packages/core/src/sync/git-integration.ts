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
import { join } from "path";
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
   * Apply commit mode: do nothing special (files will be tracked)
   */
  private async applyCommitMode(
    workspaceRoot: string,
    files: string[],
  ): Promise<GitModeResult> {
    // Ensure files are NOT in .gitignore
    const gitignorePath = join(workspaceRoot, ".gitignore");

    if (existsSync(gitignorePath)) {
      // Note: We don't automatically remove from .gitignore in commit mode
      // to avoid conflicts. User should manage .gitignore manually or use migrate command.
    }

    return {
      mode: "commit",
      action: "ready to commit",
      filesAffected: files,
    };
  }

  /**
   * Apply branch mode: create feature branch and stage files
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

    // Generate branch name if not provided
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const branch = branchName || `aligntrue/sync-${timestamp}`;

    try {
      // Create and checkout new branch using execFileSync to avoid shell injection
      execFileSync("git", ["checkout", "-b", branch], {
        cwd: workspaceRoot,
        stdio: "pipe",
      });

      // Stage the generated files using execFileSync to avoid shell injection
      for (const file of files) {
        const fullPath = join(workspaceRoot, file);
        if (existsSync(fullPath)) {
          execFileSync("git", ["add", file], {
            cwd: workspaceRoot,
            stdio: "pipe",
          });
        }
      }

      return {
        mode: "branch",
        action: "created branch and staged files",
        filesAffected: files,
        branchCreated: branch,
      };
    } catch (_error) {
      const message = _error instanceof Error ? _error.message : String(_error);
      throw new Error(`Failed to create git branch: ${message}`);
    }
  }

  /**
   * Update .gitignore with managed section for AlignTrue files
   *
   * @param workspaceRoot - Workspace root directory
   * @param files - Files to add to .gitignore
   * @param autoMode - Auto-gitignore mode (auto, always, never)
   * @param gitMode - Current git mode (ignore, commit, branch)
   */
  async updateGitignore(
    workspaceRoot: string,
    files: string[],
    autoMode: "auto" | "always" | "never",
    gitMode: GitMode,
  ): Promise<void> {
    // auto mode logic
    if (autoMode === "auto") {
      if (gitMode !== "ignore") return; // Only manage in ignore mode
    } else if (autoMode === "never") {
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

    // Normalize paths to relative (exporters may return absolute paths)
    const relativePaths = this.normalizePathsForGitignore(workspaceRoot, files);

    // Always include unified backups directory in the patterns
    const allPatterns = [".aligntrue/.backups/", ...relativePaths];
    content = this.addManagedSection(content, marker, endMarker, allPatterns);
    writeFileSync(gitignorePath, content, "utf-8");
  }

  /**
   * Add private rules to .gitignore with separate managed section
   *
   * @param workspaceRoot - Workspace root directory
   * @param files - Rule files to add (source paths in .aligntrue/rules/)
   */
  async addPrivateRulesToGitignore(
    workspaceRoot: string,
    files: string[],
  ): Promise<void> {
    const gitignorePath = join(workspaceRoot, ".gitignore");
    const marker = "# START AlignTrue Private Rules";
    const endMarker = "# END AlignTrue Private Rules";

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

    // Normalize paths to relative
    const relativePaths = this.normalizePathsForGitignore(workspaceRoot, files);

    content = this.addManagedSection(content, marker, endMarker, relativePaths);
    writeFileSync(gitignorePath, content, "utf-8");
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
    const { relative, isAbsolute } = require("path");
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
