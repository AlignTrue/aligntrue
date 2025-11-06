/**
 * Workflow detection for smart auto-pull behavior
 * Helps users choose between IR-source and native-format editing workflows
 */

import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import { saveConfig, type AlignTrueConfig } from "@aligntrue/core";

export type WorkflowMode = "ir_source" | "native_format" | "auto";

export interface WorkflowChoice {
  mode: WorkflowMode;
  timestamp: number;
}

/**
 * Detects and manages workflow preferences for auto-pull behavior
 */
export class WorkflowDetector {
  private workspaceRoot: string;
  private markerFile: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.markerFile = join(workspaceRoot, ".aligntrue", ".workflow-configured");
  }

  /**
   * Check if workflow has been configured (marker file exists)
   */
  isWorkflowConfigured(): boolean {
    return existsSync(this.markerFile);
  }

  /**
   * Prompt user to choose their preferred workflow
   * Returns the selected workflow mode
   */
  async promptWorkflowChoice(): Promise<WorkflowMode> {
    clack.log.info("");
    clack.log.info("🎯 Choose your editing workflow");
    clack.log.info("");
    clack.log.info("AlignTrue supports two workflows:");
    clack.log.info("  1. IR-source: Edit AGENTS.md as your source of truth");
    clack.log.info("     (Auto-pull disabled, manual control)");
    clack.log.info("");
    clack.log.info("  2. Native-format: Edit agent files directly");
    clack.log.info("     (Auto-pull enabled, changes sync automatically)");
    clack.log.info("");

    const choice = await clack.select({
      message: "Which workflow do you prefer?",
      options: [
        {
          value: "native_format",
          label: "Edit native agent formats (recommended for solo devs)",
          hint: "Auto-pull enabled - edit .cursor rules directly",
        },
        {
          value: "ir_source",
          label: "Edit AGENTS.md as source of truth",
          hint: "Auto-pull disabled - manual control over sync",
        },
        {
          value: "auto",
          label: "Let me decide each time",
          hint: "Keep current behavior with conflict prompts",
        },
      ],
    });

    if (clack.isCancel(choice)) {
      // User cancelled - default to auto mode
      return "auto";
    }

    return choice as WorkflowMode;
  }

  /**
   * Save workflow choice to config and create marker file
   */
  async saveWorkflowChoice(
    mode: WorkflowMode,
    config: AlignTrueConfig,
    configPath: string,
  ): Promise<void> {
    // Update config based on workflow mode
    const updatedConfig: AlignTrueConfig = { ...config };

    if (!updatedConfig.sync) {
      updatedConfig.sync = {};
    }

    // Set workflow_mode in config
    updatedConfig.sync.workflow_mode = mode;

    // Adjust auto_pull based on workflow
    if (mode === "ir_source") {
      updatedConfig.sync.auto_pull = false;
      updatedConfig.sync.on_conflict = "keep_ir";
    } else if (mode === "native_format") {
      updatedConfig.sync.auto_pull = true;
      updatedConfig.sync.on_conflict = "accept_agent";
    }
    // For "auto" mode, keep existing settings

    // Save updated config
    await saveConfig(updatedConfig, configPath, this.workspaceRoot);

    // Create marker file with timestamp and choice
    const choice: WorkflowChoice = {
      mode,
      timestamp: Date.now(),
    };

    try {
      writeFileSync(this.markerFile, JSON.stringify(choice, null, 2), "utf-8");
    } catch (_err) {
      // Non-critical - log warning but don't fail
      clack.log.warn(
        `Warning: Failed to create workflow marker file: ${_err instanceof Error ? _err.message : String(_err)}`,
      );
    }

    // Show confirmation message
    clack.log.success(`Workflow configured: ${mode}`);

    if (mode === "ir_source") {
      clack.log.info("  ✓ Auto-pull disabled");
      clack.log.info("  ✓ Edit AGENTS.md as your source");
      clack.log.info("  ✓ Use --accept-agent to pull from agents explicitly");
    } else if (mode === "native_format") {
      clack.log.info("  ✓ Auto-pull enabled");
      clack.log.info(
        "  ✓ Edit agent files directly (e.g., .cursor/rules/*.mdc)",
      );
      clack.log.info("  ✓ Changes sync to AGENTS.md automatically");
    } else {
      clack.log.info("  ✓ Manual conflict resolution enabled");
      clack.log.info("  ✓ You'll be prompted when conflicts occur");
    }
  }

  /**
   * Read workflow choice from marker file
   */
  readWorkflowChoice(): WorkflowChoice | null {
    if (!existsSync(this.markerFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.markerFile, "utf-8");
      const choice = JSON.parse(content) as WorkflowChoice;
      return choice;
    } catch {
      return null;
    }
  }

  /**
   * Get workflow mode from config or marker file
   */
  getWorkflowMode(config: AlignTrueConfig): WorkflowMode {
    // First check config
    if (config.sync?.workflow_mode) {
      return config.sync.workflow_mode;
    }

    // Fall back to marker file
    const choice = this.readWorkflowChoice();
    if (choice) {
      return choice.mode;
    }

    // Default to auto if not configured
    return "auto";
  }
}

/**
 * Get annotation comment for generated files based on workflow mode
 */
export function getWorkflowAnnotation(
  mode: WorkflowMode,
  fileType: "agent" | "ir",
): string | null {
  if (mode === "ir_source" && fileType === "agent") {
    return "<!-- Generated by AlignTrue - do not edit directly -->";
  }

  if (mode === "native_format" && fileType === "ir") {
    return "<!-- Auto-synced from agent files - edit native formats instead -->";
  }

  // No annotation needed for auto mode or mismatched types
  return null;
}
