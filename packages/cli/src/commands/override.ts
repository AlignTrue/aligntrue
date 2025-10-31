/**
 * Override command - Manage overlays for customizing upstream rules
 * Phase 3.5 Session 8: CLI implementation with commander pattern
 */

import { Command } from "commander";
import { createOverrideAddCommand } from "./override-add.js";
import { createOverrideStatusCommand } from "./override-status.js";
import { createOverrideDiffCommand } from "./override-diff.js";
import { createOverrideRemoveCommand } from "./override-remove.js";

/**
 * Main override command with subcommands
 */
export async function overrideCommand(args: string[]): Promise<void> {
  const program = new Command();

  program
    .name("override")
    .description("Manage overlays for fork-safe customization")
    .addCommand(createOverrideAddCommand())
    .addCommand(createOverrideStatusCommand())
    .addCommand(createOverrideDiffCommand())
    .addCommand(createOverrideRemoveCommand());

  await program.parseAsync(args, { from: "user" });
}
