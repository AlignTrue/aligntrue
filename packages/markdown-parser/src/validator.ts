/**
 * Validate markdown-sourced IR against schema
 *
 * TODO: Implement sections-only validation
 * Parser-based import is not yet implemented for sections-only format.
 */

import { validateAlignSchema } from "@aligntrue/schema";
import { parseMarkdown } from "./parser.js";
import { buildIR, type IRBuildError } from "./ir-builder.js";

export interface MarkdownValidationError {
  line: number;
  section?: string;
  field?: string;
  message: string;
}

export interface MarkdownValidationResult {
  valid: boolean;
  errors: MarkdownValidationError[];
}

/**
 * Validate markdown file containing aligntrue blocks
 * @deprecated Fenced block format is deprecated. Use natural markdown sections instead.
 */
export async function validateMarkdown(
  markdown: string,
): Promise<MarkdownValidationResult> {
  const errors: MarkdownValidationError[] = [];

  // Step 1: Try parsing as fenced blocks first
  const parseResult = parseMarkdown(markdown);

  if (parseResult.errors.length > 0) {
    errors.push(
      ...parseResult.errors.map((err) => ({
        line: err.line,
        message: err.message,
      })),
    );
    return { valid: false, errors };
  }

  // Step 2: Build IR from fenced blocks
  const irResult = buildIR(parseResult.blocks);

  if (irResult.errors.length > 0) {
    errors.push(...mapIRBuildErrors(irResult.errors));
    return { valid: false, errors };
  }

  if (!irResult.document) {
    errors.push({
      line: 1,
      message: "Failed to build IR document from markdown blocks",
    });
    return { valid: false, errors };
  }

  // Step 3: Validate against schema
  const schemaResult = validateAlignSchema(irResult.document);

  if (!schemaResult.valid && schemaResult.errors) {
    errors.push(...mapSchemaErrors(schemaResult.errors, parseResult.blocks));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Map IR build errors to markdown validation errors
 */
function mapIRBuildErrors(
  buildErrors: IRBuildError[],
): MarkdownValidationError[] {
  return buildErrors.map((err) => {
    const message = err.section
      ? `Section "${err.section}": ${err.message}`
      : err.message;

    return {
      line: err.line,
      ...(err.section !== undefined && { section: err.section }),
      message,
    };
  });
}

/**
 * Map schema validation errors back to markdown line numbers
 */
function mapSchemaErrors(
  schemaErrors: Array<{ path: string; message: string }>,
  blocks: Array<{ startLine: number; sectionTitle?: string }>,
): MarkdownValidationError[] {
  return schemaErrors.map((err) => {
    // Try to map path to a specific block
    // For now, use first block as fallback
    const block = blocks[0];

    return {
      line: block?.startLine || 1,
      ...(block?.sectionTitle !== undefined && { section: block.sectionTitle }),
      field: err.path,
      message: `${err.path}: ${err.message}`,
    };
  });
}
