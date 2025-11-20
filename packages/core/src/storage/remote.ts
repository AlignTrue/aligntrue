/**
 * Remote storage backend
 * Stores rules in a remote git repository
 */

import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { IStorageBackend, Rules } from "./backend.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { parseNaturalMarkdown } from "../parsing/natural-markdown.js";

export class RemoteStorageBackend implements IStorageBackend {
  private fileWriter: AtomicFileWriter;
  private remotePath: string;
  private rulesFile: string;

  constructor(
    private cwd: string,
    private scope: string,
    private url: string,
    private branch: string = "main",
    private subPath: string = "",
  ) {
    this.fileWriter = new AtomicFileWriter();
    this.remotePath = join(cwd, ".aligntrue", ".remotes", scope);
    this.rulesFile = join(this.remotePath, subPath, "rules.md");
  }

  async read(): Promise<Rules> {
    // Ensure remote is cloned
    await this.ensureCloned();

    // Pull latest changes
    await this.pull();

    if (!existsSync(this.rulesFile)) {
      return [];
    }

    try {
      const content = readFileSync(this.rulesFile, "utf-8");
      const parsed = parseNaturalMarkdown(content);
      return parsed.sections || [];
    } catch (err) {
      console.warn(
        `Failed to read remote storage for scope "${this.scope}":`,
        err,
      );
      return [];
    }
  }

  async write(rules: Rules): Promise<void> {
    // Ensure remote is cloned
    await this.ensureCloned();

    // Ensure subdirectory exists
    const dir = join(this.remotePath, this.subPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Convert sections to markdown
    const content = this.sectionsToMarkdown(rules);

    // Write atomically
    await this.fileWriter.write(this.rulesFile, content);
  }

  async sync(): Promise<void> {
    // Ensure remote is cloned
    await this.ensureCloned();

    // Commit and push changes
    try {
      // Check if there are changes
      const status = execSync("git status --porcelain", {
        cwd: this.remotePath,
        encoding: "utf-8",
      });

      if (!status.trim()) {
        // No changes to commit
        return;
      }

      // Add all changes
      execSync("git add .", { cwd: this.remotePath });

      // Commit
      execSync(`git commit -m "Update ${this.scope} rules from AlignTrue"`, {
        cwd: this.remotePath,
      });

      // Push
      execSync(`git push origin ${this.branch}`, { cwd: this.remotePath });
    } catch (err) {
      throw new Error(
        `Failed to sync remote storage for scope "${this.scope}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async ensureCloned(): Promise<void> {
    if (existsSync(this.remotePath)) {
      // Already cloned
      return;
    }

    // Clone the repository
    const remoteDir = join(this.cwd, ".aligntrue", ".remotes");
    try {
      mkdirSync(remoteDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    try {
      execSync(`git clone --branch ${this.branch} ${this.url} ${this.scope}`, {
        cwd: remoteDir,
        stdio: "pipe",
      });
    } catch (err) {
      throw new Error(
        `Failed to clone remote repository for scope "${this.scope}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async pull(): Promise<void> {
    try {
      execSync(`git pull origin ${this.branch}`, {
        cwd: this.remotePath,
        stdio: "pipe",
      });
    } catch (err) {
      // Pull might fail if there are local changes or conflicts
      // For now, just warn
      console.warn(`Failed to pull remote for scope "${this.scope}":`, err);
    }
  }

  private sectionsToMarkdown(rules: Rules): string {
    let markdown = `# ${this.scope} Rules\n\n`;

    for (const section of rules) {
      const level = section.level || 2;
      const heading = "#".repeat(level);
      markdown += `${heading} ${section.heading}\n\n`;
      markdown += `${section.content}\n\n`;
    }

    return markdown;
  }
}
