import type { AlignTrueConfig } from "@aligntrue/core";

export type NextStepsSyncGuidance = "standard" | "deferred";

export interface NextStepsOptions {
  mode: AlignTrueConfig["mode"] | undefined;
  syncGuidance: NextStepsSyncGuidance;
}

export function buildNextStepsMessage(options: NextStepsOptions): string {
  const lines = ["Next steps:"];
  const syncDescription =
    options.syncGuidance === "deferred"
      ? "Generate agent files once you add another agent file or need exports"
      : "Sync rules to every agent whenever you make changes";

  lines.push(`  aligntrue sync        ${syncDescription}`);
  lines.push("  aligntrue adapters    Manage AI agent integrations");
  lines.push("  aligntrue status      Check exporters and sync health");
  lines.push("  aligntrue config      View or edit configuration");
  lines.push(
    "  aligntrue backup      Create backup (AlignTrue auto-creates one before sync)",
  );

  if (options.mode === "team") {
    lines.push("  aligntrue team        Manage team mode settings");
  } else {
    lines.push(
      "  aligntrue team enable Create a team workspace when you're ready",
    );
  }

  lines.push("  aligntrue --help      See all commands");

  return lines.join("\n");
}
