/**
 * Command registry for CLI
 */

export interface Command {
  name: string;
  description: string;
  execute(args: string[]): Promise<void>;
}

export const commands: Record<string, Command> = {};

// Commands will be registered here in future steps

