/**
 * CLAUDE.md exporter
 * Claude Code global instructions with link-based rule references
 *
 * Claude Code supports reading CLAUDE.md files with links to external documents.
 * This exporter generates a well-formatted CLAUDE.md that references .aligntrue/rules/
 * files, allowing Claude to read the canonical rules directly.
 */

import { createMarkdownExporter } from "../base/markdown-exporter-factory.js";

export default createMarkdownExporter({
  name: "claude",
  filename: "CLAUDE.md",
  title: "CLAUDE.md",
  description: "for Claude Code",
});
