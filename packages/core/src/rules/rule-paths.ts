import { basename, dirname, isAbsolute, join, relative } from "path";
import type { RuleFile } from "@aligntrue/schema";

export interface RulePathContext {
  cwd: string; // Workspace root (absolute)
  rulesDir: string; // Rules directory (absolute or relative to cwd)
}

export interface RulePaths {
  /**
   * Path relative to the workspace root (cwd). Example: ".aligntrue/rules/deep/rule.md"
   */
  path: string;
  /**
   * Path relative to the rules directory. Example: "deep/rule.md"
   */
  relativePath: string;
  /**
   * Basename of the file. Example: "rule.md"
   */
  filename: string;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Compute all three RuleFile path fields from an absolute file path.
 * This is the single source of truth for path computation.
 */
export function computeRulePaths(
  absoluteFilePath: string,
  ctx: RulePathContext,
): RulePaths {
  const absoluteRulesDir = isAbsolute(ctx.rulesDir)
    ? ctx.rulesDir
    : join(ctx.cwd, ctx.rulesDir);

  const workspaceRelative = normalizePath(relative(ctx.cwd, absoluteFilePath));
  const rulesRelative = normalizePath(
    relative(absoluteRulesDir, absoluteFilePath),
  );

  return {
    path: workspaceRelative,
    relativePath: rulesRelative,
    filename: basename(absoluteFilePath),
  };
}

/**
 * Update path fields after a rename while preserving directory structure.
 */
export function updateRulePathsForRename(
  currentPaths: Pick<RulePaths, "relativePath">,
  newFilename: string,
  ctx: RulePathContext,
): RulePaths {
  const absoluteRulesDir = isAbsolute(ctx.rulesDir)
    ? ctx.rulesDir
    : join(ctx.cwd, ctx.rulesDir);

  const currentDir = dirname(currentPaths.relativePath);
  const newRelativePath =
    currentDir && currentDir !== "."
      ? join(currentDir, newFilename)
      : newFilename;
  const absolutePath = join(absoluteRulesDir, newRelativePath);

  return computeRulePaths(absolutePath, ctx);
}

export interface RulePathValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a RuleFile's paths are internally consistent.
 * Intended for tests and assertions.
 */
export function validateRulePaths(
  rule: Pick<RuleFile, "path" | "relativePath" | "filename">,
  ctx: RulePathContext,
): RulePathValidationResult {
  const errors: string[] = [];
  const normalizedPath = normalizePath(rule.path);
  const normalizedRelativePath = rule.relativePath
    ? normalizePath(rule.relativePath)
    : undefined;

  if (isAbsolute(rule.path)) {
    errors.push(`path "${rule.path}" is absolute; must be relative to cwd`);
  }

  const expectedRulesPrefix = normalizePath(
    isAbsolute(ctx.rulesDir) ? relative(ctx.cwd, ctx.rulesDir) : ctx.rulesDir,
  );
  if (!normalizedPath.startsWith(expectedRulesPrefix)) {
    errors.push(
      `path "${rule.path}" should start with "${expectedRulesPrefix}" (rulesDir relative to cwd)`,
    );
  }

  if (basename(normalizedPath) !== rule.filename) {
    errors.push(
      `filename "${rule.filename}" does not match basename of path "${basename(normalizedPath)}"`,
    );
  }

  if (normalizedRelativePath) {
    if (isAbsolute(rule.relativePath!)) {
      errors.push(
        `relativePath "${rule.relativePath}" is absolute; must be relative to rulesDir`,
      );
    }
    if (basename(normalizedRelativePath) !== rule.filename) {
      errors.push(
        `relativePath basename "${basename(normalizedRelativePath)}" does not match filename "${rule.filename}"`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
