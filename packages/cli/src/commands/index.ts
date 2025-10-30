/**
 * Command registry for CLI
 */

export interface Command {
  name: string;
  description: string;
  execute(args: string[]): Promise<void>;
}

export const commands: Record<string, Command> = {};

// Export commands
export { init } from "./init.js";
export { importCommand } from "./import.js";
export { migrate } from "./migrate.js";
export { md } from "./md.js";
export { sync } from "./sync.js";
export { team } from "./team.js";
export { telemetry } from "./telemetry.js";
export { scopes } from "./scopes.js";
export { check } from "./check.js";
export { config } from "./config.js";
export { adapters } from "./adapters.js";
export { privacyCommand as privacy } from "./privacy.js";
export { backupCommand as backup } from "./backup.js";
export { plugsCommand as plugs } from "./plugs-command.js";
export { pull } from "./pull.js";
export { link } from "./link.js";
export { drift } from "./drift.js";
export { update } from "./update.js";
export { onboard } from "./onboard.js";
export { overrideCommand as override } from "./override.js";
