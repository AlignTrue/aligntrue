/**
 * Markdown validation and formatting commands
 */

import { readFileSync, writeFileSync, renameSync } from "fs";
import {
  parseMarkdown,
  buildIR,
  buildIRAuto,
  normalizeWhitespace,
  generateMarkdown,
} from "@aligntrue/markdown-parser";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--check",
    hasValue: false,
    description: "Dry-run mode (format only, no writes)",
  },
  {
    flag: "--output",
    hasValue: true,
    description: "Output file path (default: stdout)",
  },
  {
    flag: "--preserve-style",
    hasValue: false,
    description: "Use _markdown_meta if present (generate only)",
  },
  {
    flag: "--canonical",
    hasValue: false,
    description: "Force canonical formatting (generate only)",
  },
  {
    flag: "--header",
    hasValue: true,
    description: "Custom header text (generate only)",
  },
];

export async function md(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length < 2) {
    showStandardHelp({
      name: "md",
      description: "Validate and compile literate markdown files",
      usage: "aligntrue md <subcommand> <file> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue md lint AGENTS.md",
        "aligntrue md format AGENTS.md",
        "aligntrue md compile AGENTS.md --output rules.yaml",
        "aligntrue md generate rules.yaml --output AGENTS.md",
      ],
      notes: [
        "Subcommands:",
        "  lint <file>       Validate markdown (natural sections or fenced blocks)",
        "  format <file>     Normalize whitespace in aligntrue blocks",
        "  compile <file>    Convert markdown to aligntrue.yaml",
        "  generate <file>   Convert YAML to markdown (round-trip)",
      ],
    });
    process.exit(0);
  }

  const subcommand = parsed.positional[0];
  const file = parsed.positional[1];

  if (!file) {
    console.error("Error: File path required");
    console.error("Run: aligntrue md --help");
    process.exit(1);
  }

  switch (subcommand) {
    case "lint":
      await mdLint(file);
      break;
    case "format":
      await mdFormat(
        file,
        (parsed.flags["check"] as boolean | undefined) || false,
      );
      break;
    case "compile":
      await mdCompile(file, parsed.flags["output"] as string | undefined);
      break;
    case "generate":
      await mdGenerate(file, parsed.flags);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue md --help");
      process.exit(1);
  }
}

async function mdLint(file: string): Promise<void> {
  try {
    const content = readFileSync(file, "utf-8");

    // Auto-detect format (fenced blocks vs natural sections)
    const buildResult = buildIRAuto(content);

    if (buildResult.errors.length > 0) {
      console.error(`✗ ${file} has errors:\n`);
      for (const error of buildResult.errors) {
        const location = error.section
          ? `Line ${error.line} (${error.section})`
          : `Line ${error.line}`;
        console.error(`  ${location}: ${error.message}`);
      }
      process.exit(1);
    }

    if (!buildResult.document) {
      console.error(`✗ ${file} validation failed\n`);
      console.error("  No valid content found\n");
      console.error(
        "  Ensure file has either fenced ```aligntrue blocks or natural markdown sections with frontmatter\n",
      );
      process.exit(1);
    }

    console.log(`✓ ${file} is valid`);
    recordEvent({ command_name: "md-lint", align_hashes_used: [] });
    process.exit(0);
  } catch (err) {
    console.error(
      `Error reading file: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

async function mdFormat(file: string, checkOnly: boolean): Promise<void> {
  try {
    const content = readFileSync(file, "utf-8");
    const parseResult = parseMarkdown(content);

    if (parseResult.errors.length > 0) {
      console.error(`✗ ${file} has parse errors:\n`);
      for (const error of parseResult.errors) {
        console.error(`  Line ${error.line}: ${error.message}`);
      }
      process.exit(1);
    }

    // Normalize whitespace in each block
    const lines = content.split("\n");
    let modified = false;

    for (const block of parseResult.blocks) {
      const normalized = normalizeWhitespace(block.content);
      if (normalized !== block.content) {
        modified = true;

        // Replace block content in-place
        // Find the block in the original content
        let currentLine = block.startLine;
        const blockLines = normalized.split("\n");

        // Remove old content
        lines.splice(
          currentLine,
          block.endLine - block.startLine - 1,
          ...blockLines,
        );
      }
    }

    if (checkOnly) {
      if (modified) {
        console.log(`✗ ${file} needs formatting`);
        process.exit(1);
      } else {
        console.log(`✓ ${file} is already formatted`);
        process.exit(0);
      }
    }

    if (modified) {
      // Write formatted content atomically (temp + rename)
      const tempPath = `${file}.tmp`;
      writeFileSync(tempPath, lines.join("\n"), "utf-8");
      renameSync(tempPath, file);
      console.log(`✓ ${file} formatted`);
    } else {
      console.log(`✓ ${file} already formatted`);
    }

    recordEvent({ command_name: "md-format", align_hashes_used: [] });
    process.exit(0);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

async function mdCompile(file: string, outputFile?: string): Promise<void> {
  try {
    const content = readFileSync(file, "utf-8");
    const parseResult = parseMarkdown(content);

    if (parseResult.errors.length > 0) {
      console.error(`✗ ${file} has parse errors:\n`);
      for (const error of parseResult.errors) {
        console.error(`  Line ${error.line}: ${error.message}`);
      }
      process.exit(1);
    }

    const irResult = buildIR(parseResult.blocks);

    if (irResult.errors.length > 0) {
      console.error(`✗ ${file} has IR build errors:\n`);
      for (const error of irResult.errors) {
        const location = error.section
          ? `Line ${error.line} (${error.section})`
          : `Line ${error.line}`;
        console.error(`  ${location}: ${error.message}`);
      }
      process.exit(1);
    }

    if (!irResult.document) {
      console.error("✗ Failed to build IR document");
      process.exit(1);
    }

    // Convert to YAML with provenance comment
    const yamlContent = stringifyYaml(irResult.document);
    const output = `# Generated from ${file}\n# Source format: markdown\n\n${yamlContent}`;

    if (!outputFile || outputFile === "-") {
      console.log(output);
    } else {
      // Write compiled output atomically (temp + rename)
      const tempPath = `${outputFile}.tmp`;
      writeFileSync(tempPath, output, "utf-8");
      renameSync(tempPath, outputFile);
      console.log(`✓ Compiled ${file} → ${outputFile}`);
    }

    recordEvent({ command_name: "md-compile", align_hashes_used: [] });
    process.exit(0);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

async function mdGenerate(
  file: string,
  flags: Record<string, boolean | string | undefined>,
): Promise<void> {
  try {
    // Read YAML file
    const content = readFileSync(file, "utf-8");
    const ir = parseYaml(content);

    if (!ir || typeof ir !== "object") {
      console.error("✗ Invalid YAML file");
      process.exit(1);
    }

    // Parse generation options
    const preserveStyle = flags["preserve-style"] as boolean | undefined;
    const canonical = flags["canonical"] as boolean | undefined;
    const headerText = flags["header"] as string | undefined;
    const outputFile = flags["output"] as string | undefined;

    // Generate markdown
    const generateOpts: {
      preserveMetadata?: boolean;
      headerText?: string;
    } = {};

    if (preserveStyle && !canonical) {
      generateOpts.preserveMetadata = true;
    }

    if (headerText) {
      generateOpts.headerText = headerText;
    }
    const markdown = generateMarkdown(ir, generateOpts);

    // Write output
    if (!outputFile || outputFile === "-") {
      console.log(markdown);
    } else {
      // Write generated markdown atomically (temp + rename)
      const tempPath = `${outputFile}.tmp`;
      writeFileSync(tempPath, markdown, "utf-8");
      renameSync(tempPath, outputFile);
      console.log(`✓ Generated ${file} → ${outputFile}`);
    }

    recordEvent({ command_name: "md-generate", align_hashes_used: [] });
    process.exit(0);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
