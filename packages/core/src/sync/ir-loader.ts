/**
 * IR loading with YAML format support
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { extname, dirname, relative } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  validateAlignSchema,
  type Align,
  type Plugs,
  type RuleFrontmatter,
} from "@aligntrue/schema";
import { checkFileSize } from "../performance/index.js";
import type { AlignTrueMode, AlignTrueConfig } from "../config/index.js";
import { resolvePlugsForAlign, mergePlugs } from "../plugs/index.js";

/**
 * Result of loading and resolving IR
 */
export interface IRResult {
  ir: Align;
  success: boolean;
  warnings: string[];
  unresolvedPlugsCount: number;
}

/**
 * Load IR from a YAML file or multiple source files and resolve plugs
 *
 * @param sourcePath - Path to the source file or directory
 * @param options - Loading options (mode, max size, force flag, config, strict plugs)
 */
export async function loadIRAndResolvePlugs(
  sourcePath: string,
  options?: {
    mode?: AlignTrueMode;
    maxFileSizeMb?: number;
    force?: boolean;
    config?: AlignTrueConfig;
    plugFills?: Record<string, string>;
  },
): Promise<IRResult> {
  const warnings: string[] = [];
  let unresolvedPlugsCount = 0;

  try {
    // Load base IR
    const ir = await loadIR(sourcePath, options);

    // Resolve plugs (Plugs system)
    if (ir.plugs) {
      const plugsResult = resolvePlugsForAlign(
        ir,
        options?.plugFills, // Pass config fills so they're available during resolution
        { failOnUnresolved: true },
      );

      if (!plugsResult.success) {
        return {
          ir, // Return partial IR for context
          success: false,
          warnings: plugsResult.errors || ["Plugs resolution failed"],
          unresolvedPlugsCount: plugsResult.unresolvedRequired.length,
        };
      }

      // Update sections with resolved guidance (only if sections exist)
      if (ir.sections && plugsResult.rules.length === ir.sections.length) {
        ir.sections = ir.sections.map((section, idx) => {
          const resolvedRule = plugsResult.rules[idx];
          if (resolvedRule?.content) {
            return {
              ...section,
              content: resolvedRule.content,
            };
          }
          return section;
        });
      }

      // Add unresolved plugs as warnings and track count
      if (plugsResult.unresolvedRequired.length > 0) {
        unresolvedPlugsCount = plugsResult.unresolvedRequired.length;
        warnings.push(
          `Unresolved required plugs: ${plugsResult.unresolvedRequired.join(", ")}`,
        );
      }
    }

    return {
      ir,
      success: true,
      warnings,
      unresolvedPlugsCount,
    };
  } catch (err) {
    return {
      ir: {
        id: "error",
        version: "0.0.0",
        spec_version: "1",
        sections: [],
      } as Align, // Dummy align
      success: false,
      warnings: [err instanceof Error ? err.message : String(err)],
      unresolvedPlugsCount: 0,
    };
  }
}

/**
 * Load IR from a YAML file, directory of markdown files, or multiple source files
 *
 * Supports:
 * - Single YAML file (.yaml/.yml)
 * - Single markdown file (.md)
 * - Directory of markdown files (loads all *.md recursively)
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
): Promise<Align> {
  const { lstatSync } = await import("fs");

  const mode = options?.mode || "solo";
  const maxFileSizeMb = options?.maxFileSizeMb || 10;
  const force = options?.force || false;

  // Check if sourcePath is a directory - if so, load rules from .md files
  if (existsSync(sourcePath)) {
    const stat = lstatSync(sourcePath);
    if (stat.isDirectory()) {
      const { loadRulesDirectory } = await import("../rules/file-io.js");
      const rules = await loadRulesDirectory(sourcePath, process.cwd(), {
        recursive: true,
      });

      // Convert RuleFile[] to Align format
      // Use frontmatter.id if specified, otherwise use filename (without .md extension)
      // This makes rule IDs intuitive and stable - typescript-strict.md becomes rule[id=typescript-strict]
      const sections = rules.map((rule) => {
        // Extract scope from frontmatter if it's a valid approval scope
        const frontmatterScope = rule.frontmatter.scope;
        const approvalScope =
          frontmatterScope === "personal" ||
          frontmatterScope === "team" ||
          frontmatterScope === "shared"
            ? (frontmatterScope as "team" | "personal" | "shared")
            : undefined;

        // Normalize path separators for cross-platform consistency
        const normalizedRulePath = rule.path.replace(/\\/g, "/");

        // Infer nested_location from source path (e.g., apps/docs/.aligntrue/rules/foo.md -> apps/docs)
        let nestedLocation: string | undefined;
        const normalizedRelPath = relative(process.cwd(), rule.path).replace(
          /\\/g,
          "/",
        );
        const marker = "/.aligntrue/rules/";
        const markerIndex = normalizedRelPath.indexOf(marker);
        if (markerIndex > 0) {
          const prefix = normalizedRelPath.slice(0, markerIndex);
          if (prefix) {
            const parts = prefix.split("/").filter(Boolean);
            // Use the deepest two path segments to keep nested location concise
            nestedLocation =
              parts.length > 1
                ? parts.slice(parts.length - 2).join("/")
                : prefix;
          }
        }

        const frontmatterWithNested =
          nestedLocation && !rule.frontmatter.nested_location
            ? { ...rule.frontmatter, nested_location: nestedLocation }
            : rule.frontmatter;

        return {
          heading: rule.frontmatter.title || rule.filename.replace(/\.md$/, ""),
          content: rule.content,
          level: 2, // Schema requires level 2-6 (## through ######)
          fingerprint:
            ((rule.frontmatter as Record<string, unknown>)["id"] as string) ||
            rule.filename.replace(/\.md$/, ""),
          source_file: normalizedRulePath,
          // Store frontmatter in vendor.aligntrue for export fidelity (not directly on section)
          vendor: {
            aligntrue: {
              frontmatter: frontmatterWithNested,
            },
          },
          // Only include scope if it's a valid approval scope (exactOptionalPropertyTypes requires this)
          ...(approvalScope && { scope: approvalScope }),
        };
      });

      // Extract and merge plugs from all rule files' frontmatter
      const allPlugsSources: Array<{ plugs?: Plugs; source: string }> = [];
      for (const rule of rules) {
        const fm = rule.frontmatter as Record<string, unknown>;
        const fmPlugs = fm["plugs"];
        if (fmPlugs && typeof fmPlugs === "object") {
          allPlugsSources.push({
            plugs: fmPlugs as Plugs,
            source: rule.path,
          });
        }
      }

      // Merge plugs if any were found
      let mergedPlugs: Plugs | undefined;
      if (allPlugsSources.length > 0) {
        mergedPlugs = mergePlugs(allPlugsSources);
      }

      return {
        id: "rules-bundle",
        version: "1.0.0",
        spec_version: "1",
        sections,
        plugs: mergedPlugs,
      } as Align;
    }
  }

  // Check file exists

  // Safe: Paths from config are validated via validateScopePath() at config load time (packages/core/src/config/index.ts:662)
  // Paths from getAlignTruePaths().rules are safe internal paths
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
    // Safe: Paths from config are validated via validateScopePath() at config load time (packages/core/src/config/index.ts:662)
    // Paths from getAlignTruePaths().rules are safe internal paths
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
      const { parseNaturalMarkdown } =
        await import("../parsing/natural-markdown.js");
      const parsed = parseNaturalMarkdown(content);

      // Convert to Align format
      ir = {
        id: parsed.metadata.id || "imported-align",
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
  const align = ir as Align;
  if (!align.sections) {
    align.sections = [];
  }

  // Ensure source_file is set for single-file loads (used by exporters and metadata)
  if (align.sections && align.sections.length > 0) {
    align.sections = align.sections.map((section) => {
      const source =
        typeof section.source_file === "string"
          ? section.source_file
          : sourcePath;

      return {
        ...section,
        source_file: source.replace(/\\/g, "/"),
      };
    });
  }

  // Inject nested_location for single-file loads when path indicates nested rules
  const singleFileNestedLocation = (() => {
    const parts = sourcePath.replace(/\\/g, "/").split("/");
    const alignIdx = parts.findIndex((p) => p === ".aligntrue");
    if (alignIdx > 0) {
      const prefixParts = parts.slice(Math.max(0, alignIdx - 2), alignIdx);
      return prefixParts.join("/");
    }
    return undefined;
  })();

  if (singleFileNestedLocation && align.sections) {
    align.sections = align.sections.map((section) => {
      const existingFrontmatter = (section.vendor?.aligntrue?.frontmatter ??
        {}) as RuleFrontmatter;

      const nestedLocation =
        typeof existingFrontmatter["nested_location"] === "string"
          ? existingFrontmatter["nested_location"]
          : singleFileNestedLocation;

      const updatedFrontmatter: RuleFrontmatter =
        nestedLocation === undefined
          ? { ...existingFrontmatter }
          : { ...existingFrontmatter, nested_location: nestedLocation };

      const hasFrontmatter =
        Object.keys(updatedFrontmatter).length > 0 &&
        Object.values(updatedFrontmatter).some((v) => v !== undefined);

      return {
        ...section,
        source_file: section.source_file || sourcePath,
        vendor: {
          ...section.vendor,
          ...(hasFrontmatter
            ? {
                aligntrue: {
                  ...(section.vendor?.aligntrue || {}),
                  frontmatter: updatedFrontmatter,
                },
              }
            : section.vendor?.aligntrue
              ? {
                  aligntrue: {
                    ...(section.vendor?.aligntrue || {}),
                  },
                }
              : {}),
        },
      };
    });
  }

  const validation = validateAlignSchema(align);
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
                id: 'Align identifier (e.g., "my-project")',
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

  // Final pass: ensure nested_location is populated from source_file when missing
  if (align.sections) {
    const rulesMarker = "/.aligntrue/rules/";
    const normalizedCwd = process.cwd().replace(/\\/g, "/");

    align.sections = align.sections.map((section) => {
      const fm = (section.vendor?.aligntrue?.frontmatter ??
        {}) as RuleFrontmatter;
      const normalizedSource = section.source_file
        ? section.source_file.replace(/\\/g, "/")
        : undefined;

      if (
        fm["nested_location"] ||
        !normalizedSource ||
        !normalizedSource.includes(rulesMarker)
      ) {
        return section;
      }

      const relSource = relative(normalizedCwd, normalizedSource).replace(
        /\\/g,
        "/",
      );
      const idx = relSource.indexOf(rulesMarker);
      if (idx < 0) return section;

      const prefix = relSource.slice(0, idx);
      if (!prefix) return section;
      const parts = prefix.split("/").filter(Boolean);
      const nestedLoc =
        parts.length > 1 ? parts.slice(parts.length - 2).join("/") : prefix;

      return {
        ...section,
        vendor: {
          ...section.vendor,
          aligntrue: {
            ...(section.vendor?.aligntrue || {}),
            frontmatter: {
              ...fm,
              nested_location: nestedLoc,
            },
          },
        },
      };
    });
  }

  return align;
}

/**
 * Save IR to a YAML file
 *
 * @param targetPath - Path to save the IR file
 * @param align - Align to save
 * @param options - Save options
 * @param options.silent - Skip validation errors (for intermediate merge states)
 */
export async function saveIR(
  targetPath: string,
  align: Align,
  options?: { silent?: boolean },
): Promise<void> {
  // Validate align before saving (unless silent mode)
  if (!options?.silent) {
    const validation = validateAlignSchema(align);
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
                  id: 'Align identifier (e.g., "my-project")',
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
        `✗ Invalid IR align:\n\n${errorList}\n\n` +
          `Fix: Add missing fields before saving.`,
      );
    }
  }

  // Ensure directory exists
  const dir = dirname(targetPath);
  try {
    // Safe: targetPath is typically from getAlignTruePaths().rules (safe internal path) or validated user path
    mkdirSync(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Convert to YAML
  const yamlContent = stringifyYaml(align, {
    indent: 2,
    lineWidth: 0, // No line wrapping
    defaultStringType: "QUOTE_DOUBLE",
  });

  // Write file
  try {
    // Safe: targetPath is typically from getAlignTruePaths().rules (safe internal path) or validated user path
    writeFileSync(targetPath, yamlContent, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to write IR file: ${targetPath}\n` +
        `  ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
