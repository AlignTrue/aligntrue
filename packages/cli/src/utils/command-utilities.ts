/**
 * Shared CLI command utilities
 *
 * Provides standardized arg parsing, help display, and lifecycle management
 * for consistent command behavior across AlignTrue CLI.
 */

import * as clack from "@clack/prompts";
import { AlignTrueError } from "./error-types.js";

/**
 * Common argument definitions for CLI commands
 */
export interface ArgDefinition {
  /** Flag name (e.g., '--help', '--config') */
  flag: string;
  /** Short alias (e.g., '-h', '-c') */
  alias?: string;
  /** Whether this flag takes a value */
  hasValue: boolean;
  /** Description for help text */
  description: string;
  /** Default value if not provided */
  defaultValue?: unknown;
}

/**
 * Parsed arguments result
 */
export interface ParsedArgs {
  /** Parsed flags as key-value pairs */
  flags: Record<string, boolean | string | undefined>;
  /** Remaining positional arguments */
  positional: string[];
  /** Whether --help was requested */
  help: boolean;
}

/**
 * Standard help configuration
 */
export interface HelpConfig {
  /** Command name (e.g., 'sync', 'check') */
  name: string;
  /** Brief description */
  description: string;
  /** Usage pattern (e.g., 'aligntrue sync [options]') */
  usage: string;
  /** Argument definitions for Options section */
  args?: ArgDefinition[];
  /** Example commands */
  examples?: string[];
  /** Additional notes */
  notes?: string[];
}

/**
 * Lifecycle execution options
 */
export interface LifecycleOptions {
  /** Command name */
  commandName: string;
  /** Whether to show intro/outro */
  showIntro?: boolean;
  /** Intro message (default: command name) */
  introMessage?: string;
  /** Success outro message */
  successMessage?: string;
}

/**
 * Options for command error handling
 */
export interface CommandErrorOptions {
  /** Optional hint shown after the error message */
  hint?: string;
  /** Custom error code for diagnostics (default: CLI_COMMAND_ERROR/CLI_USAGE_ERROR) */
  code?: string;
  /** Suggested follow-up actions */
  nextSteps?: string[];
}

/**
 * Throw a standardized AlignTrueError instead of calling process.exit
 */
export function exitWithError(
  exitCode: number,
  message?: string,
  options: CommandErrorOptions = {},
): never {
  const resolvedMessage =
    message || (exitCode === 2 ? "Invalid command usage" : "Command failed");

  const error = new AlignTrueError(
    resolvedMessage,
    options.code || (exitCode === 2 ? "CLI_USAGE_ERROR" : "CLI_COMMAND_ERROR"),
    exitCode,
    options.hint,
    options.nextSteps,
  );

  if (options.nextSteps) {
    error.nextSteps = options.nextSteps;
  }

  throw error;
}

/**
 * Parse common command-line arguments with standardized flag handling
 *
 * Handles --help/-h automatically and extracts common flags like --config,
 * --dry-run, --force. Returns parsed flags and remaining positional args.
 *
 * @param args - Raw argument array (typically from process.argv.slice(2))
 * @param definitions - Argument definitions for this command
 * @param options - Parsing options (strict mode, etc.)
 * @returns Parsed flags and positional arguments
 *
 * @example
 * ```typescript
 * const parsed = parseCommonArgs(args, [
 *   { flag: '--config', alias: '-c', hasValue: true, description: 'Config file path' },
 *   { flag: '--dry-run', hasValue: false, description: 'Dry run mode' }
 * ])
 *
 * if (parsed.help) {
 *   showStandardHelp({ name: 'sync', description: '...', usage: '...' })
 *   process.exit(0)
 * }
 * ```
 */
export function parseCommonArgs(
  args: string[],
  definitions: ArgDefinition[] = [],
  options: { strict?: boolean } = { strict: true },
): ParsedArgs {
  const flags: Record<string, boolean | string | undefined> = {};
  const positional: string[] = [];
  let help = false;

  // Build lookup maps for fast access
  const flagMap = new Map<string, ArgDefinition>();
  const aliasMap = new Map<string, ArgDefinition>();

  for (const def of definitions) {
    flagMap.set(def.flag, def);
    if (def.alias) {
      aliasMap.set(def.alias, def);
    }

    // Set default values
    if (def.defaultValue !== undefined) {
      const key = def.flag.replace(/^--/, "");
      const value = def.defaultValue;
      if (typeof value === "string" || typeof value === "boolean") {
        flags[key] = value;
      }
    }
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // Check for help flag
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    // Check if this is a defined flag
    const def = flagMap.get(arg) || aliasMap.get(arg);

    if (def) {
      const key = def.flag.replace(/^--/, "");

      if (def.hasValue) {
        // Flag expects a value
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          flags[key] = nextArg;
          i++; // Skip next arg (it's the value)
        } else {
          throw new Error(`Flag ${def.flag} requires a value`);
        }
      } else {
        // Boolean flag
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      // Unknown flag
      if (options?.strict !== false) {
        // In strict mode, reject unknown flags
        const validFlags = definitions
          .map((d) => (d.alias ? `${d.flag}, ${d.alias}` : d.flag))
          .join(", ");
        throw new Error(
          `Unknown flag: ${arg}\nValid flags: ${validFlags}\nUse --help to see all options`,
        );
      } else {
        // In non-strict mode, accept unknown flags as boolean (backward compatibility)
        const key = arg.replace(/^--?/, "");
        flags[key] = true;
      }
    } else {
      // Positional argument
      positional.push(arg);
    }
  }

  return { flags, positional, help };
}

/**
 * Display standardized help text for a command
 *
 * Shows usage, description, options, examples, and notes in a consistent
 * format across all commands.
 *
 * @param config - Help configuration for the command
 *
 * @example
 * ```typescript
 * showStandardHelp({
 *   name: 'sync',
 *   description: 'Sync rules to agents',
 *   usage: 'aligntrue sync [options]',
 *   args: [
 *     { flag: '--dry-run', hasValue: false, description: 'Preview changes without writing' },
 *     { flag: '--config', alias: '-c', hasValue: true, description: 'Config file path' }
 *   ],
 *   examples: [
 *     'aligntrue sync',
 *     'aligntrue sync --dry-run',
 *     'aligntrue sync --config custom.yaml'
 *   ],
 *   notes: ['Note: This command requires .aligntrue/config.yaml']
 * })
 * ```
 */
export function showStandardHelp(config: HelpConfig): void {
  // Usage line
  console.log(`Usage: ${config.usage}\n`);

  // Description
  console.log(`${config.description}\n`);

  // Options section
  if (config.args && config.args.length > 0) {
    console.log("Options:");

    // Calculate max flag width for alignment
    const maxWidth = Math.max(
      ...config.args.map((arg) => {
        const flags = arg.alias ? `${arg.flag}, ${arg.alias}` : arg.flag;
        return flags.length;
      }),
    );

    for (const arg of config.args) {
      const flags = arg.alias ? `${arg.flag}, ${arg.alias}` : arg.flag;
      const padding = " ".repeat(maxWidth - flags.length + 2);
      console.log(`  ${flags}${padding}${arg.description}`);
    }
    console.log();
  }

  // Examples section
  if (config.examples && config.examples.length > 0) {
    console.log("Examples:");
    for (const example of config.examples) {
      console.log(`  ${example}`);
    }
    console.log();
  }

  // Notes section
  if (config.notes && config.notes.length > 0) {
    for (const note of config.notes) {
      console.log(note);
    }
    console.log();
  }
}

/**
 * Execute a command with standardized lifecycle management
 *
 * Wraps command execution with intro/outro and error handling.
 * Ensures consistent UX across all commands.
 *
 * @param fn - Async function to execute
 * @param options - Lifecycle configuration
 * @returns Promise that resolves when execution completes
 *
 * @example
 * ```typescript
 * await executeWithLifecycle(
 *   async () => {
 *     // Command logic here
 *     await syncRulesToAgents()
 *   },
 *   {
 *     commandName: 'sync',
 *     showIntro: true,
 *     introMessage: 'Syncing rules to agents',
 *     successMessage: '✓ Sync complete'
 *   }
 * )
 * ```
 */
export async function executeWithLifecycle(
  fn: () => Promise<void>,
  options: LifecycleOptions,
): Promise<void> {
  const {
    commandName,
    showIntro = false,
    introMessage,
    successMessage,
  } = options;

  try {
    // Show intro if requested
    if (showIntro) {
      clack.intro(introMessage || commandName);
    }

    // Execute command logic
    await fn();

    // Show success outro if message provided
    if (successMessage) {
      clack.outro(successMessage);
    }
  } catch (error) {
    // Handle execution errors
    if (error instanceof Error && error.message.includes("process.exit")) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");

    clack.log.error(`Command failed: ${message}`);
    clack.outro("✗ Operation failed");
    exitWithError(1, message);
  }
}

/**
 * Options for formatting created files output
 */
export interface FormatCreatedFilesOptions {
  /** Max files to show per folder before truncating (default: 3) */
  maxPerFolder?: number;
  /** Whether to use console.log instead of clack.log (default: false) */
  nonInteractive?: boolean;
}

/**
 * Format and display a list of created files, grouped by directory
 *
 * Groups files by their parent directory and shows a truncated list
 * with counts for each folder. Provides a clean, consolidated view
 * instead of listing each file on a separate line.
 *
 * @param files - Array of file paths (e.g., ['.aligntrue/rules/typescript.md', '.aligntrue/config.yaml'])
 * @param options - Formatting options
 *
 * @example
 * ```typescript
 * formatCreatedFiles([
 *   '.aligntrue/rules/typescript.md',
 *   '.aligntrue/rules/testing.md',
 *   '.aligntrue/rules/global.md',
 *   '.aligntrue/config.yaml',
 *   '.aligntrue/README.md'
 * ])
 * // Output:
 * // Created 5 files:
 * //   .aligntrue/rules/ (3 files):
 * //     - typescript.md
 * //     - testing.md
 * //     - global.md
 * //   .aligntrue/ (2 files):
 * //     - config.yaml
 * //     - README.md
 * ```
 */
export function formatCreatedFiles(
  files: string[],
  options: FormatCreatedFilesOptions = {},
): void {
  const { maxPerFolder = 3, nonInteractive = false } = options;

  if (files.length === 0) {
    return;
  }

  // Normalize paths to forward slashes for consistent display across platforms
  // (path.join() uses backslashes on Windows, but forward slashes are universally readable)
  const normalizedFiles = files.map((f) => f.replace(/\\/g, "/"));

  // Group files by parent directory
  const grouped = new Map<string, string[]>();

  for (const file of normalizedFiles) {
    // Get parent directory (e.g., '.aligntrue/rules/' from '.aligntrue/rules/typescript.md')
    const lastSlash = file.lastIndexOf("/");
    const dir = lastSlash >= 0 ? file.slice(0, lastSlash + 1) : "./";
    const filename = lastSlash >= 0 ? file.slice(lastSlash + 1) : file;

    if (!grouped.has(dir)) {
      grouped.set(dir, []);
    }
    grouped.get(dir)!.push(filename);
  }

  // Sort directories so deeper paths come first (e.g., .aligntrue/rules/ before .aligntrue/)
  const sortedDirs = Array.from(grouped.keys()).sort(
    (a, b) => b.length - a.length,
  );

  // Build output lines
  const lines: string[] = [];
  lines.push(`Created ${files.length} files:`);

  for (const dir of sortedDirs) {
    const dirFiles = grouped.get(dir)!;
    const fileCount = dirFiles.length;
    const showFiles = dirFiles.slice(0, maxPerFolder);
    const remaining = fileCount - showFiles.length;

    lines.push(
      `  ${dir} (${fileCount} ${fileCount === 1 ? "file" : "files"}):`,
    );

    for (const f of showFiles) {
      lines.push(`    - ${f}`);
    }

    if (remaining > 0) {
      lines.push(`    ... and ${remaining} more`);
    }
  }

  // Output the formatted message
  const message = lines.join("\n");

  if (nonInteractive) {
    console.log(message);
  } else {
    clack.log.success(message);
  }
}

/**
 * Options for formatting discovered files output
 */
export interface FormatDiscoveredFilesOptions {
  /** Max groups to show before truncating (default: 5) */
  maxGroups?: number;
  /** How to group files: by directory path or by type property */
  groupBy?: "directory" | "type";
}

/**
 * Discovered file with optional type for grouping
 */
export interface DiscoveredFile {
  /** Relative path to the file */
  relativePath?: string | undefined;
  /** Full path to the file */
  path: string;
  /** Optional type for grouping (e.g., 'cursor', 'agents', 'claude') */
  type?: string | undefined;
}

/**
 * Format a consolidated discovery summary for scanned files
 *
 * Returns a formatted string showing file counts grouped by directory or type.
 * Use this for scan/detect operations before user confirmation.
 *
 * @param files - Array of discovered files
 * @param options - Formatting options
 * @returns Formatted discovery message string
 *
 * @example
 * ```typescript
 * // Group by directory (default)
 * const msg = formatDiscoveredFiles([
 *   { relativePath: '.cursor/rules/global.mdc', path: '/abs/.cursor/rules/global.mdc' },
 *   { relativePath: 'apps/docs/.cursor/rules/web.mdc', path: '/abs/apps/docs/.cursor/rules/web.mdc' },
 * ])
 * // Returns: "Found 2 files in 2 folders"
 *
 * // Group by type
 * const msg = formatDiscoveredFiles(files, { groupBy: "type" })
 * // Returns: "Found 16 agent files:\n  CURSOR (10 files)\n  AGENTS (6 files)"
 * ```
 */
export function formatDiscoveredFiles(
  files: DiscoveredFile[],
  options: FormatDiscoveredFilesOptions = {},
): string {
  const { maxGroups = 5, groupBy = "directory" } = options;

  if (files.length === 0) {
    return "No files found";
  }

  // Group files
  const grouped = new Map<string, DiscoveredFile[]>();

  for (const file of files) {
    let groupKey: string;

    if (groupBy === "type" && file.type) {
      groupKey = file.type.toUpperCase();
    } else {
      // Group by directory
      const relativePath = (file.relativePath || file.path).replace(/\\/g, "/");
      const lastSlash = relativePath.lastIndexOf("/");
      groupKey = lastSlash >= 0 ? relativePath.slice(0, lastSlash + 1) : "./";
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(file);
  }

  const groupCount = grouped.size;

  // Build the message
  if (groupBy === "type") {
    // Type grouping: "Found 16 agent files:"
    const lines: string[] = [];
    lines.push(
      `Found ${files.length} agent file${files.length !== 1 ? "s" : ""}:`,
    );

    // Sort by count descending
    const sortedGroups = Array.from(grouped.entries()).sort(
      (a, b) => b[1].length - a[1].length,
    );

    const showGroups = sortedGroups.slice(0, maxGroups);
    for (const [type, typeFiles] of showGroups) {
      lines.push(
        `  ${type} (${typeFiles.length} file${typeFiles.length !== 1 ? "s" : ""})`,
      );
    }

    if (sortedGroups.length > maxGroups) {
      lines.push(`  ... and ${sortedGroups.length - maxGroups} more types`);
    }

    return lines.join("\n");
  } else {
    // Directory grouping
    if (groupCount === 1) {
      // Single folder: "Found 16 files in .cursor/rules/"
      const folderName = Array.from(grouped.keys())[0]!;
      return `Found ${files.length} file${files.length !== 1 ? "s" : ""} in ${folderName}`;
    } else {
      // Multiple folders: "Found 16 files in 4 folders"
      return `Found ${files.length} file${files.length !== 1 ? "s" : ""} in ${groupCount} folder${groupCount !== 1 ? "s" : ""}`;
    }
  }
}
