/**
 * Local storage backend
 * Stores rules in .aligntrue/.local/<scope>/
 */

import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { IStorageBackend, Rules } from "./backend.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { parseNaturalMarkdown } from "../parsing/natural-markdown.js";

export class LocalStorageBackend implements IStorageBackend {
  private fileWriter: AtomicFileWriter;
  private storagePath: string;

  constructor(
    private cwd: string,
    private scope: string,
  ) {
    this.fileWriter = new AtomicFileWriter();
    this.storagePath = join(cwd, ".aligntrue", ".local", scope);
  }

  async read(): Promise<Rules> {
    const rulesFile = join(this.storagePath, "rules.md");

    if (!existsSync(rulesFile)) {
      return [];
    }

    try {
      const content = readFileSync(rulesFile, "utf-8");
      const parsed = parseNaturalMarkdown(content);
      return parsed.sections || [];
    } catch (err) {
      console.warn(
        `Failed to read local storage for scope "${this.scope}":`,
        err,
      );
      return [];
    }
  }

  async write(rules: Rules): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }

    const rulesFile = join(this.storagePath, "rules.md");

    // Convert sections to markdown
    const content = this.sectionsToMarkdown(rules);

    // Write atomically
    await this.fileWriter.write(rulesFile, content);
  }

  async sync(): Promise<void> {
    // Local storage doesn't sync to remote
    // This is a no-op
  }

  private sectionsToMarkdown(rules: Rules): string {
    let markdown = "# Local Rules\n\n";

    for (const section of rules) {
      const level = section.level || 2;
      const heading = "#".repeat(level);
      markdown += `${heading} ${section.heading}\n\n`;
      markdown += `${section.content}\n\n`;
    }

    return markdown;
  }
}
