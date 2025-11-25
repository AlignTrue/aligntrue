/**
 * Repo storage backend
 * Stores rules in the main repository (e.g., AGENTS.md, .aligntrue/rules/)
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import { IStorageBackend, Rules } from "./backend.js";
import { parseNaturalMarkdown } from "../parsing/natural-markdown.js";
import type { AlignSection } from "@aligntrue/schema";

export class RepoStorageBackend implements IStorageBackend {
  private rulesDir: string;

  constructor(
    private cwd: string,
    private scope: string,
  ) {
    // Use .aligntrue/rules directory for markdown-based rules
    this.rulesDir = join(cwd, ".aligntrue", "rules");
  }

  async read(): Promise<Rules> {
    // Also check AGENTS.md as fallback
    const agentsMd = join(this.cwd, "AGENTS.md");

    // Prefer rules directory, fallback to AGENTS.md
    if (existsSync(this.rulesDir)) {
      try {
        const sections: AlignSection[] = [];
        const files = readdirSync(this.rulesDir).filter((f) =>
          f.endsWith(".md"),
        );

        for (const file of files) {
          const filePath = join(this.rulesDir, file);
          const content = readFileSync(filePath, "utf-8");
          const parsed = parseNaturalMarkdown(content);
          if (parsed.sections) {
            sections.push(...parsed.sections);
          }
        }

        return sections;
      } catch (err) {
        console.warn(
          `Failed to read rules directory for scope "${this.scope}":`,
          err,
        );
        return [];
      }
    }

    // Fallback to AGENTS.md
    if (!existsSync(agentsMd)) {
      return [];
    }

    try {
      const content = readFileSync(agentsMd, "utf-8");
      const parsed = parseNaturalMarkdown(content);
      return parsed.sections || [];
    } catch (err) {
      console.warn(
        `Failed to read repo storage for scope "${this.scope}":`,
        err,
      );
      return [];
    }
  }

  async write(rules: Rules): Promise<void> {
    // Ensure rules directory exists
    ensureDirectoryExists(this.rulesDir);

    // Write each section as a separate markdown file
    for (const section of rules) {
      const filename = this.sanitizeFilename(section.heading) + ".md";
      const filePath = join(this.rulesDir, filename);
      const content = this.sectionToMarkdown(section);
      writeFileSync(filePath, content, "utf-8");
    }
  }

  async sync(): Promise<void> {
    // Repo storage doesn't sync to remote automatically
    // User must commit and push manually
    // This is a no-op
  }

  private sanitizeFilename(heading: string): string {
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private sectionToMarkdown(section: AlignSection): string {
    const level = section.level || 2;
    const prefix = "#".repeat(level);
    return `${prefix} ${section.heading}\n\n${section.content}\n`;
  }
}
