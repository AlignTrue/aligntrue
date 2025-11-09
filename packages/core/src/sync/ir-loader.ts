/**
 * IR loading with YAML format support
 */

import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import { parse as parseYaml } from "yaml";
import { validateAlignSchema, type AlignPack } from "@aligntrue/schema";
import { checkFileSize } from "../performance/index.js";
import type { AlignTrueMode } from "../config/index.js";

/**
 * Load IR from a YAML file
 *
 * Note: The IR file (.aligntrue/.rules.yaml) is internal and auto-generated.
 * Users should edit agent files (AGENTS.md, .cursor/*.mdc) instead.
 *
 * @param sourcePath - Path to the source file
 * @param options - Loading options (mode, max size, force flag)
 */
export async function loadIR(
  sourcePath: string,
  options?: {
    mode?: AlignTrueMode;
    maxFileSizeMb?: number;
    force?: boolean;
  },
): Promise<AlignPack> {
  const mode = options?.mode || "solo";
  const maxFileSizeMb = options?.maxFileSizeMb || 10;
  const force = options?.force || false;

  // Check file exists
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Source file not found: ${sourcePath}\n` +
        `  Check the path is correct and the file exists.`,
    );
  }

  // Check file size before reading
  checkFileSize(sourcePath, maxFileSizeMb, mode, force);

  // Read file content
  let content: string;
  try {
    content = readFileSync(sourcePath, "utf8");
  } catch (_err) {
    throw new Error(
      `Failed to read source file: ${sourcePath}\n` +
        `  ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // Validate file extension
  const ext = extname(sourcePath).toLowerCase();
  let ir: unknown;

  if (ext === ".yaml" || ext === ".yml") {
    // Parse YAML directly
    try {
      ir = parseYaml(content);
    } catch (_err) {
      const yamlErr = _err as { mark?: { line?: number; column?: number } };
      const location = yamlErr.mark
        ? ` at line ${yamlErr.mark.line! + 1}, column ${yamlErr.mark.column! + 1}`
        : "";

      throw new Error(
        `Failed to parse YAML in ${sourcePath}${location}\n` +
          `  ${_err instanceof Error ? _err.message : String(_err)}\n` +
          `  Check for syntax errors (indentation, quotes, colons).`,
      );
    }
  } else {
    throw new Error(
      `Unsupported file format: ${ext}\n` +
        `  IR files must be in YAML format (.yaml or .yml)\n` +
        `  Source: ${sourcePath}\n` +
        `  Note: Users should edit agent files (AGENTS.md, .cursor/*.mdc), not the IR file directly.`,
    );
  }

  // Validate loaded IR
  if (typeof ir !== "object" || ir === null) {
    throw new Error(
      `Invalid IR in ${sourcePath}: must be an object\n` +
        `  Got: ${typeof ir}`,
    );
  }

  const validation = validateAlignSchema(ir);
  if (!validation.valid) {
    const errorList =
      validation.errors
        ?.map((err) => `  - ${err.path}: ${err.message}`)
        .join("\n") || "  Unknown validation error";

    throw new Error(
      `Invalid IR in ${sourcePath}:\n${errorList}\n` +
        `  Fix the errors above and try again.`,
    );
  }

  return ir as AlignPack;
}
