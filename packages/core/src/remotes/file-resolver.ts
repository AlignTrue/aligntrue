/**
 * File resolver for remotes
 *
 * Determines which files go to which remote destinations
 * using scope-based routing (primary) and pattern-based routing (additive)
 */

import { join } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import micromatch from "micromatch";
import matter from "gray-matter";
import type {
  RemotesConfig,
  RemoteDestination,
  CustomRemoteDestination,
  RemoteBackupConfig,
} from "../config/types.js";
import type {
  ScopedFile,
  RuleScope,
  FileAssignment,
  FileResolutionResult,
  ResolutionWarning,
} from "./types.js";

/**
 * Collect all rule files from the rules directory with their scope
 */
function collectScopedFiles(rulesDir: string): ScopedFile[] {
  if (!existsSync(rulesDir)) {
    return [];
  }

  const files: ScopedFile[] = [];

  const collect = (dir: string, base: string = "") => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = base ? `${base}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        collect(fullPath, relativePath);
      } else if (entry.name.endsWith(".md")) {
        // Read file to get scope from frontmatter
        const scope = getScopeFromFile(fullPath);
        files.push({ path: relativePath, scope });
      }
    }
  };

  collect(rulesDir);
  return files;
}

/**
 * Get scope from a rule file's frontmatter
 */
function getScopeFromFile(filePath: string): RuleScope {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const scope = data["scope"];
    if (scope === "personal" || scope === "shared") {
      return scope;
    }
    return "team"; // Default
  } catch {
    return "team"; // Default on error
  }
}

/**
 * Normalize URL for comparison (remove trailing slashes, .git suffix)
 */
function normalizeUrl(url: string): string {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/**
 * Normalize remote destination (handle string or object)
 */
function normalizeDestination(
  dest: string | RemoteDestination | undefined,
): RemoteDestination | undefined {
  if (!dest) return undefined;
  if (typeof dest === "string") {
    return { url: dest };
  }
  return dest;
}

/**
 * Resolve file assignments for remotes using scope-based and pattern-based routing
 *
 * Rules (ADDITIVE model):
 * 1. Scope-based routing: personal/shared scope rules go to their configured remotes
 * 2. Pattern-based routing: ADDS destinations (files can go to multiple places)
 * 3. Team-scope rules stay in main repo unless matched by custom patterns
 * 4. Same file can go to multiple destinations
 */
export function resolveFileAssignments(
  config: RemotesConfig,
  rulesDir: string,
  sourceUrls: string[] = [],
): FileResolutionResult {
  const warnings: ResolutionWarning[] = [];
  const assignments = new Map<
    string,
    { files: Set<string>; config: RemoteDestination }
  >();

  // Collect all rule files with their scopes
  const scopedFiles = collectScopedFiles(rulesDir);

  if (scopedFiles.length === 0) {
    return { assignments: [], warnings: [] };
  }

  // Normalize source URLs for conflict detection
  const normalizedSourceUrls = new Set(sourceUrls.map(normalizeUrl));

  // Helper to add assignment (additive)
  const addAssignment = (
    remoteId: string,
    file: string,
    dest: RemoteDestination,
  ) => {
    // Check for source/remote conflict
    const normalizedUrl = normalizeUrl(dest.url);
    if (normalizedSourceUrls.has(normalizedUrl)) {
      warnings.push({
        type: "source-backup-conflict",
        message: `URL configured as both source and remote. Skipping: ${dest.url}`,
        url: dest.url,
      });
      return;
    }

    if (!assignments.has(remoteId)) {
      assignments.set(remoteId, { files: new Set(), config: dest });
    }
    assignments.get(remoteId)!.files.add(file);
  };

  // 1. Scope-based routing
  const personalDest = normalizeDestination(config.personal);
  const sharedDest = normalizeDestination(config.shared);

  for (const { path, scope } of scopedFiles) {
    if (scope === "personal" && personalDest) {
      addAssignment("personal", path, personalDest);
    } else if (scope === "shared" && sharedDest) {
      addAssignment("shared", path, sharedDest);
    }
    // team scope stays in main repo (no remote assignment)
  }

  // 2. Pattern-based routing (ADDITIVE)
  if (config.custom) {
    for (const custom of config.custom) {
      for (const { path, scope } of scopedFiles) {
        // Check scope filter if specified
        if (custom.scope && custom.scope !== scope) {
          continue;
        }

        // Check pattern match
        if (micromatch.isMatch(path, custom.include)) {
          const dest: RemoteDestination = { url: custom.url };
          if (custom.branch !== undefined) dest.branch = custom.branch;
          if (custom.path !== undefined) dest.path = custom.path;
          if (custom.auto !== undefined) dest.auto = custom.auto;
          addAssignment(custom.id, path, dest);
        }
      }
    }
  }

  // Convert to array format
  const result: FileAssignment[] = [];
  for (const [remoteId, { files, config: remoteConfig }] of assignments) {
    if (files.size > 0) {
      result.push({
        remoteId,
        files: Array.from(files).sort(),
        config: remoteConfig,
      });
    }
  }

  // Warn about files with no remote (only if some remotes are configured)
  const hasAnyRemote =
    personalDest || sharedDest || (config.custom && config.custom.length > 0);
  if (hasAnyRemote) {
    const allAssignedFiles = new Set<string>();
    for (const { files } of result) {
      for (const file of files) {
        allAssignedFiles.add(file);
      }
    }

    // Don't warn about team files - they're supposed to stay in main repo
    // Only warn if personal/shared files have no destination
    const personalWithoutDest = scopedFiles.filter(
      ({ path, scope }) =>
        scope === "personal" && !personalDest && !allAssignedFiles.has(path),
    );
    const sharedWithoutDest = scopedFiles.filter(
      ({ path, scope }) =>
        scope === "shared" && !sharedDest && !allAssignedFiles.has(path),
    );

    if (personalWithoutDest.length > 0) {
      warnings.push({
        type: "no-remote",
        message: `${personalWithoutDest.length} personal-scope file(s) have no remote configured. Add remotes.personal to route them.`,
        files: personalWithoutDest.map(({ path }) => path).slice(0, 5),
      });
    }

    if (sharedWithoutDest.length > 0) {
      warnings.push({
        type: "no-remote",
        message: `${sharedWithoutDest.length} shared-scope file(s) have no remote configured. Add remotes.shared to route them.`,
        files: sharedWithoutDest.map(({ path }) => path).slice(0, 5),
      });
    }
  }

  return { assignments: result, warnings };
}

/**
 * Convert legacy remote_backup config to new remotes format
 */
export function convertLegacyConfig(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  legacyConfig: RemoteBackupConfig,
): RemotesConfig {
  const remotes: RemotesConfig = {};

  // Convert additional backups to custom remotes
  if (legacyConfig.additional && legacyConfig.additional.length > 0) {
    remotes.custom = legacyConfig.additional.map((additional) => {
      const custom: CustomRemoteDestination = {
        id: additional.id,
        url: additional.url,
        include: additional.include,
      };
      if (additional.branch !== undefined) custom.branch = additional.branch;
      if (additional.path !== undefined) custom.path = additional.path;
      if (additional.auto !== undefined) custom.auto = additional.auto;
      return custom;
    });
  }

  // Convert default backup to a custom remote that matches all files
  if (legacyConfig.default) {
    if (!remotes.custom) {
      remotes.custom = [];
    }
    const defaultCustom: CustomRemoteDestination = {
      id: "default",
      url: legacyConfig.default.url,
      include: ["**/*.md"],
    };
    if (legacyConfig.default.branch !== undefined)
      defaultCustom.branch = legacyConfig.default.branch;
    if (legacyConfig.default.path !== undefined)
      defaultCustom.path = legacyConfig.default.path;
    if (legacyConfig.default.auto !== undefined)
      defaultCustom.auto = legacyConfig.default.auto;
    remotes.custom.unshift(defaultCustom);
  }

  return remotes;
}

/**
 * Get status of all configured remotes
 */
export function getRemotesStatus(
  config: RemotesConfig,
  rulesDir: string,
  sourceUrls: string[] = [],
): {
  remotes: Array<{
    id: string;
    url: string;
    branch: string;
    files: string[];
    skipped: boolean;
    skipReason?: string;
  }>;
  warnings: ResolutionWarning[];
} {
  const { assignments, warnings } = resolveFileAssignments(
    config,
    rulesDir,
    sourceUrls,
  );

  const normalizedSourceUrls = new Set(sourceUrls.map(normalizeUrl));
  const remotes: Array<{
    id: string;
    url: string;
    branch: string;
    files: string[];
    skipped: boolean;
    skipReason?: string;
  }> = [];

  // Add all configured remotes
  const personalDest = normalizeDestination(config.personal);
  const sharedDest = normalizeDestination(config.shared);

  if (personalDest) {
    const isConflict = normalizedSourceUrls.has(normalizeUrl(personalDest.url));
    const assignment = assignments.find((a) => a.remoteId === "personal");
    remotes.push({
      id: "personal",
      url: personalDest.url,
      branch: personalDest.branch || "main",
      files: assignment?.files || [],
      skipped: isConflict,
      ...(isConflict && { skipReason: "URL is also configured as a source" }),
    });
  }

  if (sharedDest) {
    const isConflict = normalizedSourceUrls.has(normalizeUrl(sharedDest.url));
    const assignment = assignments.find((a) => a.remoteId === "shared");
    remotes.push({
      id: "shared",
      url: sharedDest.url,
      branch: sharedDest.branch || "main",
      files: assignment?.files || [],
      skipped: isConflict,
      ...(isConflict && { skipReason: "URL is also configured as a source" }),
    });
  }

  if (config.custom) {
    for (const custom of config.custom) {
      const isConflict = normalizedSourceUrls.has(normalizeUrl(custom.url));
      const assignment = assignments.find((a) => a.remoteId === custom.id);
      remotes.push({
        id: custom.id,
        url: custom.url,
        branch: custom.branch || "main",
        files: assignment?.files || [],
        skipped: isConflict,
        ...(isConflict && { skipReason: "URL is also configured as a source" }),
      });
    }
  }

  return { remotes, warnings };
}
