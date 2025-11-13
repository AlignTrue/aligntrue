/**
 * IR loading with YAML format support
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { extname, dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validateAlignSchema, type AlignPack } from "@aligntrue/schema";
import { checkFileSize } from "../performance/index.js";
import type { AlignTrueMode, AlignTrueConfig } from "../config/index.js";

/**
 * Load IR from a YAML file or multiple source files
 *
 * Note: The IR file (.aligntrue/.rules.yaml) is internal and auto-generated.
 * Users should edit agent files (AGENTS.md, .cursor/*.mdc) instead.
 *
 * @param sourcePath - Path to the source file or directory
 * @param options - Loading options (mode, max size, force flag, config)
 */
export async function loadIR(
  sourcePath: string,
  options?: {
    mode?: AlignTrueMode;
    maxFileSizeMb?: number;
    force?: boolean;
    config?: AlignTrueConfig;
  },
): Promise<AlignPack> {
  const mode = options?.mode || "solo";
  const maxFileSizeMb = options?.maxFileSizeMb || 10;
  const force = options?.force || false;
  const config = options?.config;

  // If config provided with source_files, use multi-file loading
  if (config?.sync?.source_files) {
    const cwd = dirname(sourcePath);
    const { loadSourceFiles } = await import("./source-loader.js");
    return loadSourceFiles(cwd, config);
  }

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
  } else if (ext === ".md" || ext === ".markdown") {
    // Parse markdown with optional YAML frontmatter
    try {
      const { parseNaturalMarkdown } = await import(
        "../parsing/natural-markdown.js"
      );
      const parsed = parseNaturalMarkdown(content);

      // Convert to AlignPack format
      ir = {
        id: parsed.metadata.id || "imported-pack",
        version: parsed.metadata.version || "1.0.0",
        spec_version: "1",
        sections: parsed.sections,
      };

      // Add optional metadata if present (metadata may have additional properties)
      const meta = parsed.metadata as Record<string, unknown>;
      if (meta["description"]) {
        (ir as Record<string, unknown>)["description"] = meta[
          "description"
        ] as string;
      }
      if (meta["tags"]) {
        (ir as Record<string, unknown>)["tags"] = meta["tags"] as string[];
      }
    } catch (_err) {
      throw new Error(
        `Failed to parse markdown in ${sourcePath}\n` +
          `  ${_err instanceof Error ? _err.message : String(_err)}\n` +
          `  Check for valid markdown format with optional YAML frontmatter.`,
      );
    }
  } else {
    throw new Error(
      `Unsupported file format: ${ext}\n` +
        `  Supported formats: .yaml, .yml, .md, .markdown\n` +
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
        ?.map((err) => {
          // Make error messages more helpful
          if (
            err.path === "(root)" &&
            err.message.includes("required property")
          ) {
            const match = err.message.match(/required property '(\w+)'/);
            if (match && match[1]) {
              const field = match[1];
              const hints: Record<string, string> = {
                id: 'Pack identifier (e.g., "my-project")',
                version: 'Semantic version (e.g., "1.0.0")',
                spec_version: 'Must be "1"',
              };
              return `  - Missing required field: ${field}\n    ${hints[field] || ""}`;
            }
          }
          return `  - ${err.path}: ${err.message}`;
        })
        .join("\n") || "  Unknown validation error";

    throw new Error(
      `✗ Invalid IR schema\n\n` +
        `File: ${sourcePath}\n` +
        `${errorList}\n\n` +
        `Fix: Edit ${sourcePath} to add missing fields, or run 'aligntrue init' to regenerate the IR.`,
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
        ?.map((err) => {
          // Make error messages more helpful
          if (
            err.path === "(root)" &&
            err.message.includes("required property")
          ) {
            const match = err.message.match(/required property '(\w+)'/);
            if (match && match[1]) {
              const field = match[1];
              const hints: Record<string, string> = {
                id: 'Pack identifier (e.g., "my-project")',
                version: 'Semantic version (e.g., "1.0.0")',
                spec_version: 'Must be "1"',
              };
              return `  - Missing required field: ${field}\n    ${hints[field] || ""}`;
            }
          }
          return `  - ${err.path}: ${err.message}`;
        })
        .join("\n") || "  Unknown validation error";

    throw new Error(
      `✗ Invalid IR pack:\n\n${errorList}\n\n` +
        `Fix: Add missing fields before saving.`,
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
