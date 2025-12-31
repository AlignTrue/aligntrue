import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import * as clack from "@clack/prompts";
import {
  saveConfig,
  type AlignTrueConfig,
  type ConflictInfo,
} from "@aligntrue/core";
import { importRules } from "../../utils/source-resolver.js";
import { isTTY } from "../../utils/tty-helper.js";
import {
  selectFilesToImport,
  type ImportFile,
} from "../../utils/selective-import-ui.js";
import { formatCreatedFiles } from "../../utils/command-utilities.js";
import { exitWithError } from "../../utils/error-formatter.js";
import type { createManagedSpinner } from "../../utils/spinner.js";
import { writeRulesWithConflicts } from "./conflicts.js";

export async function copyRulesToLocal(options: {
  source: string;
  gitRef?: string | undefined;
  gitPath?: string | undefined;
  cwd: string;
  paths: { aligntrueDir: string };
  configPath: string;
  nonInteractive: boolean;
  noSync: boolean;
  privateSource: boolean;
  replaceConflicts: boolean;
  skipConflicts: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const {
    source,
    gitRef,
    gitPath: _gitPath,
    cwd,
    paths,
    configPath,
    nonInteractive,
    noSync,
    privateSource,
    replaceConflicts,
    skipConflicts,
    spinner,
  } = options;

  spinner.start(`Importing rules from ${source}...`);

  try {
    const rulesDir = join(paths.aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });

    if (!existsSync(configPath)) {
      const config = {
        sources: [{ type: "local" as const, path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      mkdirSync(dirname(configPath), { recursive: true });
      await saveConfig(config as AlignTrueConfig, configPath);
    }

    const result = await importRules({
      source,
      ref: gitRef,
      cwd,
      targetDir: rulesDir,
    });

    if (result.error) {
      spinner.stopSilent();
      exitWithError(
        {
          title: "Import failed",
          message: result.error,
          code: "IMPORT_FAILED",
        },
        2,
      );
      return;
    }

    if (result.rules.length === 0) {
      spinner.stop("No rules found", 1);
      if (isTTY()) {
        clack.log.warn(`No markdown rules found at ${source}`);
      } else {
        console.log(`\nWarning: No markdown rules found at ${source}`);
      }
      return;
    }

    const filesForSelection: ImportFile[] = [];
    result.rules.forEach((rule) => {
      const filePath = rule.relativePath || rule.filename;
      if (!filesForSelection.find((f) => f.relativePath === filePath)) {
        filesForSelection.push({
          path: filePath,
          relativePath: filePath,
        });
      }
    });

    let selectedRules = [...result.rules];
    if (!nonInteractive && filesForSelection.length > 0) {
      spinner.stop(`Found ${result.rules.length} rules from ${source}`);
      const selectionResult = await selectFilesToImport(filesForSelection, {
        nonInteractive: false,
      });

      if (selectionResult.skipped || selectionResult.selectedFileCount === 0) {
        clack.cancel("Import cancelled");
        return;
      }

      const selectedFilePaths = new Set(
        selectionResult.selectedFiles.map((f) => f.relativePath),
      );
      selectedRules = result.rules.filter((rule) => {
        const filePath = rule.relativePath || rule.filename;
        return selectedFilePaths.has(filePath);
      });

      spinner.start("Writing selected rules...");
    }

    const createdFiles = await writeRulesWithConflicts({
      rules: selectedRules,
      conflicts: result.conflicts as ConflictInfo[],
      cwd,
      rulesDir,
      nonInteractive,
      replaceConflicts,
      skipConflicts,
      spinner,
    });

    spinner.stop(`Imported ${createdFiles.length} rules from ${source}`);

    const fullPaths = createdFiles.map((f) => `.aligntrue/rules/${f}`);
    formatCreatedFiles(fullPaths, { nonInteractive: !isTTY() });

    if (privateSource) {
      if (isTTY()) {
        clack.log.warn(
          "Gitignored source detected (SSH authentication)\n" +
            "  Rules added to .gitignore automatically.",
        );
      } else {
        console.log("\nGitignored source detected - rules added to .gitignore");
      }

      try {
        const { GitIntegration } = await import("@aligntrue/core");
        const gitIntegration = new GitIntegration();
        await gitIntegration.addGitignoreRulesToGitignore(cwd, fullPaths);
      } catch {
        if (isTTY()) {
          clack.log.warn(
            "Failed to auto-update .gitignore. Update manually if needed.",
          );
        }
      }
    }

    let syncPerformed = false;
    if (!noSync) {
      try {
        if (isTTY()) {
          clack.log.step("Syncing rules to agents...");
        }
        const { sync } = await import("../sync/index.js");
        await sync(["--quiet"]);
        syncPerformed = true;
        if (isTTY()) {
          clack.log.success("Synced to agents");
        }
      } catch {
        if (isTTY()) {
          clack.log.warn("Auto-sync failed. Run 'aligntrue sync' manually.");
        }
      }
    }

    const tips: string[] = [];

    if (privateSource) {
      tips.push("To commit these rules: remove from .gitignore");
    } else {
      tips.push("To keep private: add '.aligntrue/rules/' to .gitignore");
    }

    tips.push("To remove: delete the files and run 'aligntrue sync'");
    tips.push("To add as connected link: use 'aligntrue add link <url>'");

    if (!syncPerformed) {
      tips.push("To apply to agents: run 'aligntrue sync'");
    }

    if (isTTY()) {
      clack.note(tips.map((t) => `• ${t}`).join("\n"), "Tips");
      clack.outro("Done");
    } else {
      console.log("\nTips:");
      tips.forEach((t) => console.log(`  • ${t}`));
    }
  } catch (error) {
    spinner.stopSilent();

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError(
      {
        title: "Import failed",
        message: `Failed to import rules: ${error instanceof Error ? error.message : String(error)}`,
        hint: "Check the URL/path format and try again.",
        code: "IMPORT_FAILED",
      },
      2,
    );
  }
}
