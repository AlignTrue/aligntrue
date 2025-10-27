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
export { init } from './init.js'
export { migrate } from './migrate.js'
export { md } from './md.js'

// Commands will be registered here in future steps

