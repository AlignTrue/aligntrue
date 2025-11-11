/**
 * Repo storage backend
 * Stores rules in the main repository (e.g., AGENTS.md, .aligntrue/.rules.yaml)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { IStorageBackend, Rules } from "./backend.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { parseMarkdownToSections } from "@aligntrue/markdown-parser";

export class RepoStorageBackend implements IStorageBackend {
  private fileWriter: AtomicFileWriter;
  private rulesPath: string;

  constructor(
    private cwd: string,
    private scope: string,
  ) {
    this.fileWriter = new AtomicFileWriter();
    // For team scope, use .aligntrue/.rules.yaml
    // For other scopes in repo, could use different paths
    this.rulesPath = join(cwd, ".aligntrue", ".rules.yaml");
  }

  async read(): Promise<Rules> {
    // Also check AGENTS.md as fallback
    const agentsMd = join(this.cwd, "AGENTS.md");
    const irPath = this.rulesPath;

    // Prefer IR, fallback to AGENTS.md
    const filePath = existsSync(irPath) ? irPath : agentsMd;

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = readFileSync(filePath, "utf-8");

      // If it's YAML IR, parse differently
      if (filePath.endsWith(".yaml")) {
        // TODO: Parse YAML IR format
        // For now, return empty
        return [];
      }

      // Parse markdown
      const parsed = parseMarkdownToSections(content);
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
    // Write to IR file
    const content = this.sectionsToYaml(rules);
    await this.fileWriter.write(this.rulesPath, content);
  }

  async sync(): Promise<void> {
    // Repo storage doesn't sync to remote automatically
    // User must commit and push manually
    // This is a no-op
  }

  private sectionsToYaml(rules: Rules): string {
    // Convert sections to YAML IR format
    let yaml = "version: '1.0'\n";
    yaml += "sections:\n";

    for (const section of rules) {
      yaml += `  - heading: ${JSON.stringify(section.heading)}\n`;
      yaml += `    content: ${JSON.stringify(section.content)}\n`;
      if (section.level) {
        yaml += `    level: ${section.level}\n`;
      }
    }

    return yaml;
  }
}
