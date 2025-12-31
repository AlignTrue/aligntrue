import { mkdirSync, rmSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import {
  detectConflicts,
  saveConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { formatCreatedFiles } from "../../utils/command-utilities.js";
import { exitWithError } from "../../utils/error-formatter.js";
import { isTTY } from "../../utils/tty-helper.js";
import { importFromCatalog } from "../../utils/catalog-import.js";
import type { createManagedSpinner } from "../../utils/spinner.js";
import { writeRulesWithConflicts } from "./conflicts.js";

export async function importCatalogCommand(options: {
  catalogId: string;
  cwd: string;
  paths: { aligntrueDir: string };
  configPath: string;
  nonInteractive: boolean;
  noSync: boolean;
  replaceConflicts: boolean;
  skipConflicts: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const {
    catalogId,
    cwd,
    paths,
    configPath,
    nonInteractive,
    noSync,
    replaceConflicts,
    skipConflicts,
    spinner,
  } = options;

  const rulesDir = join(paths.aligntrueDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  if (!existsSync(configPath)) {
    const config: AlignTrueConfig = {
      version: undefined,
      mode: "solo",
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["agents"],
    };
    mkdirSync(dirname(configPath), { recursive: true });
    await saveConfig(config, configPath);
  }

  spinner.start("Fetching from catalog...");

  let importResult: Awaited<ReturnType<typeof importFromCatalog>>;
  try {
    importResult = await importFromCatalog(catalogId, rulesDir, cwd);
  } catch (error) {
    spinner.stopSilent();
    exitWithError(
      {
        title: "Catalog import failed",
        message: error instanceof Error ? error.message : String(error),
        hint: "Check the ID or try again later.",
        code: "CATALOG_IMPORT_FAILED",
      },
      2,
    );
    return;
  }

  if (importResult.rules.length === 0) {
    spinner.stop("No rules imported from catalog", 1);
    if (importResult.warnings.length > 0 && isTTY()) {
      clack.log.warn(
        [
          "No rules were imported:",
          ...importResult.warnings.map(
            (w) => `• ${w.id}: ${w.reason || "skipped"}`,
          ),
        ].join("\n"),
      );
    }
    return;
  }

  const starterStatus = detectStarterRules(rulesDir);
  let removeStarterRules = false;

  if (starterStatus.onlyStarters && importResult.rules.length > 0) {
    if (nonInteractive) {
      if (isTTY()) {
        clack.log.info(
          "Starter rules detected; keeping both starter and pack rules. Use --replace or remove starters manually to replace them.",
        );
      } else {
        console.log(
          "Starter rules detected; keeping both starter and pack rules.",
        );
      }
    } else {
      const replaceStarters = await clack.confirm({
        message:
          "Starter rules detected. Replace starters with pack rules instead of keeping both?",
        initialValue: false,
      });
      if (clack.isCancel(replaceStarters)) {
        clack.cancel("Import cancelled");
        return;
      }
      removeStarterRules = Boolean(replaceStarters);
    }
  }

  if (removeStarterRules) {
    starterStatus.starterFiles.forEach((file) =>
      rmSync(join(rulesDir, file), { force: true }),
    );
    if (isTTY()) {
      clack.log.info("Removed starter rules before importing pack.");
    }
  }

  const conflicts = detectConflicts(
    importResult.rules.map((r) => ({
      filename: r.relativePath || r.filename,
      title: r.frontmatter.title || r.filename,
      source: `catalog:${catalogId}`,
    })),
    rulesDir,
  );

  const createdFiles = await writeRulesWithConflicts({
    rules: importResult.rules,
    conflicts,
    cwd,
    rulesDir,
    nonInteractive,
    replaceConflicts,
    skipConflicts,
    spinner,
  });

  spinner.stop(
    `Imported ${createdFiles.length} rule${createdFiles.length === 1 ? "" : "s"} from "${importResult.title}"`,
  );
  formatCreatedFiles(
    createdFiles.map((f) => `.aligntrue/rules/${f}`),
    { nonInteractive: !isTTY() },
  );

  if (importResult.warnings.length > 0) {
    const warningLines = importResult.warnings.map(
      (w) => `  • ${w.id}: ${w.reason || "skipped"}`,
    );
    if (isTTY()) {
      clack.log.warn(`Some rules were skipped:\n${warningLines.join("\n")}`);
    } else {
      console.warn(`Some rules were skipped:\n${warningLines.join("\n")}`);
    }
  }

  let syncPerformed = false;
  if (!noSync) {
    spinner.start("Syncing to agents...");
    try {
      const { sync } = await import("../sync/index.js");
      await sync(["--quiet"]);
      syncPerformed = true;
      spinner.stop("Imported and synced to agents");
    } catch {
      spinner.stop("Imported (sync failed)", 1);
      if (isTTY()) {
        clack.log.warn("Sync failed. Run 'aligntrue sync' to retry.");
      }
    }
  }

  const tips: string[] = [
    "To remove: delete the files and run 'aligntrue sync'",
    "To add as connected link: use 'aligntrue add link <github-url>'",
  ];
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
}

function detectStarterRules(rulesDir: string): {
  starterFiles: string[];
  onlyStarters: boolean;
} {
  const starterNames = new Set([
    "global.md",
    "testing.md",
    "ai-guidance.md",
    "security.md",
  ]);

  const files = readdirSync(rulesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name);

  const starterFiles = files.filter((file) => starterNames.has(file));
  const nonStarterFiles = files.filter((file) => !starterNames.has(file));

  return {
    starterFiles,
    onlyStarters: starterFiles.length > 0 && nonStarterFiles.length === 0,
  };
}
