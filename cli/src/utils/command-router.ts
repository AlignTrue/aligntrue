import { exitWithError } from "./command-utilities.js";

type Handler = (args: string[]) => Promise<void> | void;

interface SubcommandConfig {
  handler: Handler;
  description?: string;
}

interface CommandConfig {
  name: string;
  guard?: () => void;
  subcommands: Record<string, SubcommandConfig>;
}

export function defineCommand(config: CommandConfig): Handler {
  return async (args: string[]) => {
    config.guard?.();
    const sub = args[0];

    if (!sub || sub === "--help" || sub === "-h") {
      printHelp(config);
      return;
    }

    const entry = Object.entries(config.subcommands).find(
      ([name]) => name === sub,
    )?.[1];
    if (!entry) {
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: `Run aligntrue ${config.name} --help`,
      });
    }

    await entry.handler(args.slice(1));
  };
}

function printHelp(config: CommandConfig) {
  const lines = [
    `Usage: aligntrue ${config.name} <subcommand> [options]`,
    "",
    "Subcommands:",
    ...Object.entries(config.subcommands).map(([name, { description }]) =>
      description ? `  ${name.padEnd(12)} ${description}` : `  ${name}`,
    ),
  ];
  console.log(lines.join("\n"));
}
