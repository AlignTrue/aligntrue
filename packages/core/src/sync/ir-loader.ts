/**
 * IR loading with YAML format support
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { extname, dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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

  // Defensive: Ensure sections array exists (for backward compatibility)
  // This must be done BEFORE validation since schema requires sections
  const pack = ir as AlignPack;
  if (!pack.sections) {
    pack.sections = [];
  }

  const validation = validateAlignSchema(pack);
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

  return pack;
}

/**
 * Save IR to a YAML file
 *
 * @param targetPath - Path to save the IR file
 * @param pack - AlignPack to save
 */
export async function saveIR(
  targetPath: string,
  pack: AlignPack,
): Promise<void> {
  // Validate pack before saving
  const validation = validateAlignSchema(pack);
  if (!validation.valid) {
    const errorList =
      validation.errors
        ?.map((err) => `  - ${err.path}: ${err.message}`)
        .join("\n") || "  Unknown validation error";

    throw new Error(
      `Invalid IR pack:\n${errorList}\n` +
        `  Fix the errors above before saving.`,
    );
  }

  // Ensure directory exists
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Convert to YAML
  const yamlContent = stringifyYaml(pack, {
    indent: 2,
    lineWidth: 0, // No line wrapping
    defaultStringType: "QUOTE_DOUBLE",
  });

  // Write file
  try {
    writeFileSync(targetPath, yamlContent, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to write IR file: ${targetPath}\n` +
        `  ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
