/**
 * Plugs command router
 */

import { auditPlugs, resolvePlugs, setPlug } from "./plugs.js";

export async function plugsCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "--help") {
    console.log("AlignTrue Plugs Management\n");
    console.log("Usage: aligntrue plugs <subcommand> [options]\n");
    console.log("Subcommands:");
    console.log(
      "  audit          List all slots, fills, and resolution status",
    );
    console.log(
      "  resolve        Preview resolution with current fills (use --dry-run for full output)",
    );
    console.log("  set <key> <value>  Write repo-local fill with validation\n");
    console.log("Options:");
    console.log(
      "  --config <path>    Path to .aligntrue.yaml (default: .aligntrue.yaml)",
    );
    console.log(
      "  --dry-run          Show full resolved guidance (for resolve command)",
    );
    console.log(
      "  --force            Allow setting fill without declared slot (for set command)\n",
    );
    process.exit(0);
  }

  const subcommand = args[0];
  const subcommandArgs = args.slice(1);

  // Parse common options
  const configIndex = subcommandArgs.indexOf("--config");
  const config = configIndex >= 0 ? subcommandArgs[configIndex + 1] : undefined;

  try {
    if (subcommand === "audit") {
      const result = config
        ? await auditPlugs({ config })
        : await auditPlugs({});
      if (!result.success) {
        console.error(`\n❌ Error: ${result.message}\n`);
        process.exit(1);
      }
    } else if (subcommand === "resolve") {
      const dryRun = subcommandArgs.includes("--dry-run");
      const result = config
        ? await resolvePlugs({ config, dryRun })
        : await resolvePlugs({ dryRun });
      if (!result.success) {
        console.error(`\n❌ Error: ${result.message}\n`);
        process.exit(1);
      }
    } else if (subcommand === "set") {
      if (subcommandArgs.length < 2) {
        console.error(
          "\n❌ Error: set command requires <key> and <value> arguments\n",
        );
        console.log("Usage: aligntrue plugs set <key> <value> [options]\n");
        process.exit(1);
      }

      const key = subcommandArgs[0];
      const value = subcommandArgs[1];

      if (!key || !value) {
        console.error(
          "\n❌ Error: set command requires non-empty <key> and <value>\n",
        );
        process.exit(1);
      }

      const force = subcommandArgs.includes("--force");

      const result = config
        ? await setPlug(key, value, { config, force })
        : await setPlug(key, value, { force });
      if (!result.success) {
        console.error(`\n❌ Error: ${result.message}\n`);
        process.exit(1);
      }
    } else {
      console.error(`\n❌ Error: Unknown subcommand '${subcommand}'\n`);
      console.log("Run: aligntrue plugs --help\n");
      process.exit(1);
    }
  } catch (_error) {
    console.error(
      `\n❌ Error: ${_error instanceof Error ? _error.message : "Unknown error"}\n`,
    );
    process.exit(1);
  }
}
