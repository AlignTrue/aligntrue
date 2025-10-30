/**
 * Shared CLI command utilities
 *
 * Provides standardized arg parsing, help display, and lifecycle management
 * for consistent command behavior across AlignTrue CLI.
 */

import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";

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
  /** Command name for telemetry */
  commandName: string;
  /** Whether to show intro/outro */
  showIntro?: boolean;
  /** Intro message (default: command name) */
  introMessage?: string;
  /** Success outro message */
  successMessage?: string;
  /** Skip telemetry recording */
  skipTelemetry?: boolean;
}

/**
 * Parse common command-line arguments with standardized flag handling
 *
 * Handles --help/-h automatically and extracts common flags like --config,
 * --dry-run, --force. Returns parsed flags and remaining positional args.
 *
 * @param args - Raw argument array (typically from process.argv.slice(2))
 * @param definitions - Argument definitions for this command
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
          flags[key] = true; // Flag present but no value
        }
      } else {
        // Boolean flag
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      // Unknown flag - still parse as boolean
      const key = arg.replace(/^--?/, "");
      flags[key] = true;
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
 * Wraps command execution with intro/outro, telemetry recording, and
 * error handling. Ensures consistent UX across all commands.
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
    skipTelemetry = false,
  } = options;

  try {
    // Show intro if requested
    if (showIntro) {
      clack.intro(introMessage || commandName);
    }

    // Execute command logic
    await fn();

    // Record telemetry event (unless skipped)
    if (!skipTelemetry) {
      recordEvent({ command_name: commandName, align_hashes_used: [] });
    }

    // Show success outro if message provided
    if (successMessage) {
      clack.outro(successMessage);
    }
  } catch (error) {
    // Handle execution errors
    if (error instanceof Error) {
      // Check if this is a process.exit error (from tests or explicit exits)
      if (error.message.includes("process.exit")) {
        throw error;
      }

      clack.log.error(`Command failed: ${error.message}`);
    } else {
      clack.log.error(`Command failed: ${String(error)}`);
    }

    clack.outro("✗ Operation failed");
    process.exit(1);
  }
}
