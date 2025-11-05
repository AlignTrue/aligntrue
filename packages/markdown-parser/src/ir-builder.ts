/**
 * Convert markdown fenced blocks to canonical IR
 */

import { parse as parseYaml } from "yaml";
import type { FencedBlock } from "./parser.js";

export interface IRDocument {
  id: string;
  version: string;
  spec_version: string;
  rules: unknown[];
  source_format?: "markdown" | "yaml";
  guidance?: string;
  _markdown_meta?: MarkdownMetadata;
  [key: string]: unknown;
}

export interface MarkdownMetadata {
  original_structure?: "single-block" | "multi-rule";
  header_prefix?: string;
  whitespace_style?: {
    indent: "spaces" | "tabs";
    indent_size: number;
    line_endings: "lf" | "crlf";
  };
}

export interface IRBuildError {
  blockIndex: number;
  line: number;
  message: string;
  section?: string;
}

export interface IRBuildResult {
  document?: IRDocument;
  errors: IRBuildError[];
}

/**
 * Build IR document from parsed fenced blocks with optional metadata capture
 *
 * @param blocks - Parsed fenced blocks from markdown
 * @param options - Build options
 * @returns IR document with optional metadata
 */
export function buildIR(
  blocks: FencedBlock[],
  options?: { captureMetadata?: boolean; originalMarkdown?: string },
): IRBuildResult {
  const errors: IRBuildError[] = [];

  if (blocks.length === 0) {
    return {
      errors: [
        {
          blockIndex: 0,
          line: 1,
          message: "No aligntrue blocks found in markdown",
        },
      ],
    };
  }

  // For now, we expect a single document block or multiple rule blocks
  // If first block has 'id' field, treat as full document
  // Otherwise, treat all blocks as rules to be combined

  try {
    const firstBlock = blocks[0];
    if (!firstBlock) {
      return {
        errors: [
          {
            blockIndex: 0,
            line: 1,
            message: "No blocks provided",
          },
        ],
      };
    }

    const normalized = normalizeWhitespace(firstBlock.content);
    const parsed = parseYaml(normalized);

    // Check if this is a full document (has id, version, rules)
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "rules" in parsed
    ) {
      // Full document in first block - validate and return
      const doc = parsed as IRDocument;

      // Ensure source_format is set (as internal metadata, not in spec)
      if (!doc.source_format) {
        doc.source_format = "markdown";
      }

      // Merge guidance if present
      if (firstBlock.guidanceBefore && !("guidance" in doc)) {
        (doc as Record<string, unknown>)["guidance"] =
          firstBlock.guidanceBefore;
      }

      // Validation: Warn if pack-level metadata is in fenced block (will be cleaned on write)
      // These fields should be outside the fenced block or handled as metadata
      const internalFields = ["source_format", "guidance"];
      const foundInternalFields = internalFields.filter(
        (field) => field in parsed,
      );

      if (foundInternalFields.length > 0 && options?.captureMetadata) {
        // Store warning in metadata so we can clean it on next write
        if (!doc._markdown_meta) {
          doc._markdown_meta = {
            original_structure: "single-block",
          };
        }
        (
          doc._markdown_meta as Record<string, unknown>
        ).had_internal_fields_in_fence = true;
      }

      // Capture metadata for round-trip if requested
      if (options?.captureMetadata && options.originalMarkdown) {
        const indentStyle = detectIndentStyle(firstBlock.content);
        const lineEndings = detectLineEndings(options.originalMarkdown);

        const metadata: MarkdownMetadata = {
          original_structure: "single-block",
          whitespace_style: {
            indent: indentStyle.indent,
            indent_size: indentStyle.indent_size,
            line_endings: lineEndings,
          },
        };

        // Extract header prefix
        const header = extractHeaderPrefix(
          options.originalMarkdown,
          firstBlock.startLine,
        );
        if (header) {
          metadata.header_prefix = header;
        }

        doc._markdown_meta = metadata;
      }

      return { document: doc, errors: [] };
    }

    // Otherwise, treat each block as a rule and build a document
    const rules: unknown[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block) continue;

      try {
        const ruleNormalized = normalizeWhitespace(block.content);
        const rule = parseYaml(ruleNormalized);

        if (!rule || typeof rule !== "object") {
          errors.push({
            blockIndex: i,
            line: block.startLine,
            ...(block.sectionTitle !== undefined && {
              section: block.sectionTitle,
            }),
            message: "Block does not contain a valid YAML object",
          });
          continue;
        }

        // Merge guidance from markdown prose into rule
        if (block.guidanceBefore && !("guidance" in rule)) {
          (rule as Record<string, unknown>)["guidance"] = block.guidanceBefore;
        }

        rules.push(rule);
      } catch (_err) {
        errors.push({
          blockIndex: i,
          line: block.startLine,
          ...(block.sectionTitle !== undefined && {
            section: block.sectionTitle,
          }),
          message: _err instanceof Error ? _err.message : "Invalid YAML",
        });
      }
    }

    if (errors.length > 0) {
      return { errors };
    }

    // Build a minimal document from rules
    // In practice, the user should provide id/version in first block or config
    // For now, create a placeholder that will fail validation
    const document: IRDocument = {
      id: "__placeholder__",
      version: "0.0.0",
      spec_version: "1",
      rules,
      source_format: "markdown",
    };

    return { document, errors: [] };
  } catch (_err) {
    const firstBlock = blocks[0];
    errors.push({
      blockIndex: 0,
      line: firstBlock?.startLine || 1,
      ...(firstBlock?.sectionTitle !== undefined && {
        section: firstBlock.sectionTitle,
      }),
      message: _err instanceof Error ? _err.message : "Failed to parse YAML",
    });
    return { errors };
  }
}

/**
 * Normalize whitespace in YAML content
 * - Convert tabs to 2 spaces
 * - Remove trailing whitespace from lines
 * - Ensure single newline at EOF
 * - Preserve intentional blank lines
 */
export function normalizeWhitespace(yaml: string): string {
  const lines = yaml.split("\n");

  const normalized = lines.map((line) => {
    // Convert tabs to 2 spaces
    const spacesReplaced = line.replace(/\t/g, "  ");

    // Remove trailing whitespace
    return spacesReplaced.trimEnd();
  });

  // Join with newlines and ensure single newline at EOF
  let result = normalized.join("\n");

  // Remove multiple trailing newlines, ensure exactly one
  result = result.trimEnd() + "\n";

  return result;
}

/**
 * Detect indent style from YAML content
 */
export function detectIndentStyle(yaml: string): {
  indent: "spaces" | "tabs";
  indent_size: number;
} {
  const lines = yaml.split("\n");

  // Look for indented lines
  let spacesCount = 0;
  let tabsCount = 0;
  const spaceSizes: number[] = [];

  for (const line of lines) {
    if (line.startsWith("\t")) {
      tabsCount++;
    } else if (line.startsWith(" ")) {
      spacesCount++;
      // Count leading spaces
      const match = line.match(/^( +)/);
      if (match) {
        spaceSizes.push(match[1]!.length);
      }
    }
  }

  // Determine indent type
  const indent: "spaces" | "tabs" = tabsCount > spacesCount ? "tabs" : "spaces";

  // Determine indent size (most common space count, or default 2)
  let indent_size = 2;
  if (spaceSizes.length > 0) {
    // Find GCD of all indent sizes (most likely base indent)
    const sorted = [...spaceSizes].sort((a, b) => a - b);
    const smallest = sorted[0]!;
    if (smallest > 0 && smallest <= 8) {
      indent_size = smallest;
    }
  }

  return { indent, indent_size };
}

/**
 * Detect line ending style
 */
export function detectLineEndings(text: string): "lf" | "crlf" {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/(?<!\r)\n/g) || []).length;

  return crlfCount > lfCount ? "crlf" : "lf";
}

/**
 * Extract markdown header before first block
 */
export function extractHeaderPrefix(
  markdown: string,
  firstBlockLine: number,
): string | undefined {
  const lines = markdown.split("\n");
  const beforeBlock = lines.slice(0, firstBlockLine - 1);

  // Find the first header line
  for (const line of beforeBlock) {
    if (line.match(/^#+ /)) {
      return line.trim();
    }
  }

  return undefined;
}
