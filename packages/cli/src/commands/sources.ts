/**
 * Source file management commands
 * List, split, and manage multi-file rule organization
 */

import * as clack from "@clack/prompts";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join, basename } from "path";
import { loadConfig } from "@aligntrue/core";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { backupOverwrittenFile } from "@aligntrue/core";
import {
  selectFilesToImport,
  type ImportFile,
} from "../utils/selective-import-ui.js";

/**
 * Main sources command handler
 */
export async function sources(args: string[]): Promise<void> {
  const subcommand = args[0];
  const flags = parseFlags(args.slice(1));

  switch (subcommand) {
    case "list":
      await listSources(flags);
      break;
    case "split":
      await splitSources(flags);
      break;
    case "detect":
      await detectSources(flags);
      break;
    case undefined:
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      showHelp();
      process.exit(1);
  }
}

/**
 * List all configured sources (local, catalog, git, url)
 */
async function listSources(_flags: Record<string, unknown>): Promise<void> {
  const cwd = process.cwd();

  try {
    clack.intro("Sources");

    // Load config
    const config = await loadConfig(undefined, cwd);

    if (!config.sources || config.sources.length === 0) {
      clack.log.warn("No sources configured");
      clack.outro("Done");
      return;
    }

    clack.log.success(
      `Found ${config.sources.length} source(s) (priority order):\n`,
    );

    // Group sources by type for display
    const sourcesByType: Record<string, unknown[]> = {};
    config.sources.forEach((source: unknown) => {
      const sourceObj = source as Record<string, unknown>;
      const type = (sourceObj["type"] as string) || "unknown";
      if (!sourcesByType[type]) {
        sourcesByType[type] = [];
      }
      sourcesByType[type].push(source);
    });

    // Display sources grouped by type with priority numbers
    let priority = 1;

    // Order types for consistent output
    const typeOrder = ["local", "catalog", "git", "url"];
    for (const type of typeOrder) {
      const sources = sourcesByType[type];
      if (!sources) continue;

      for (const source of sources) {
        const sourceObj = source as Record<string, unknown>;
        const sourceType = sourceObj["type"] as string;

        console.log(`${priority}. ${sourceType.toUpperCase()}`);

        if (sourceType === "local") {
          const path = sourceObj["path"] as string;
          console.log(`   Path: ${path}`);

          // Count files in local directory
          const localRulesDir = join(cwd, path);
          if (existsSync(localRulesDir)) {
            const { loadRulesDirectory } = await import("@aligntrue/core");
            const ruleFiles = await loadRulesDirectory(localRulesDir, cwd, {
              recursive: true,
            });
            let totalLines = 0;
            ruleFiles.forEach((rule) => {
              totalLines += rule.content.split("\n").length;
            });
            console.log(`   Files: ${ruleFiles.length}, Lines: ${totalLines}`);
          }
        } else if (sourceType === "git") {
          const url = sourceObj["url"] as string;
          const ref = (sourceObj["ref"] as string) || "main";
          const path = sourceObj["path"] as string;
          console.log(`   URL: ${url}`);
          console.log(`   Ref: ${ref}`);
          if (path) {
            console.log(`   Path: ${path}`);
          }

          // Check cache status
          const cacheDir = join(cwd, ".aligntrue", ".cache", "git");
          if (existsSync(cacheDir)) {
            console.log(`   Cache: available`);
          } else {
            console.log(`   Cache: not yet fetched`);
          }
        } else if (sourceType === "url") {
          const url = sourceObj["url"] as string;
          console.log(`   URL: ${url}`);
          console.log(`   Cache: check needed`);
        } else if (sourceType === "catalog") {
          const id = (sourceObj["id"] as string) || "unknown";
          console.log(`   Catalog ID: ${id}`);
        }

        console.log("");
        priority++;
      }
    }

    // Record telemetry
    recordEvent({
      command_name: "sources_list",
      align_hashes_used: [],
    });

    clack.outro("Done");
  } catch (error) {
    clack.log.error(
      `Failed to list sources: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Split AGENTS.md into multiple files
 */
async function splitSources(flags: Record<string, unknown>): Promise<void> {
  const cwd = process.cwd();
  const yes = flags["yes"] || false;

  try {
    clack.intro("Split AGENTS.md into multiple files");

    // Check if AGENTS.md exists
    const agentsMdPath = join(cwd, "AGENTS.md");
    if (!existsSync(agentsMdPath)) {
      clack.log.error("AGENTS.md not found in current directory");
      process.exit(1);
    }

    // Parse AGENTS.md
    const content = readFileSync(agentsMdPath, "utf-8");
    const { parseAgentsMd } = await import("@aligntrue/schema");
    const parsed = parseAgentsMd(content);

    if (parsed.sections.length === 0) {
      clack.log.warn("AGENTS.md has no sections to split");
      clack.outro("Nothing to do");
      return;
    }

    // Analyze file size
    const { analyzeFileSize } = await import("../utils/file-size-detector.js");
    const analysis = analyzeFileSize(agentsMdPath, "AGENTS.md");

    // Show file size info
    clack.log.info(
      `AGENTS.md: ${analysis.lineCount} lines, ${parsed.sections.length} sections\n`,
    );

    if (analysis.severity === "urgent") {
      clack.log.warn(
        `⚠️  File is very large (${analysis.lineCount} lines). Splitting is strongly recommended.`,
      );
    } else if (analysis.severity === "warning") {
      clack.log.info(
        `💡 File is getting large (${analysis.lineCount} lines). Splitting will help with maintainability.`,
      );
    }

    // Show sections preview
    clack.log.info("Sections to split:\n");
    const maxPreview = 10;
    for (let i = 0; i < Math.min(parsed.sections.length, maxPreview); i++) {
      console.log(`  - ${parsed.sections[i]!.heading}`);
    }
    if (parsed.sections.length > maxPreview) {
      console.log(`  ... and ${parsed.sections.length - maxPreview} more`);
    }
    console.log("");

    // Ask for confirmation
    if (!yes) {
      const confirm = await clack.confirm({
        message: "Split these sections into separate files?",
        initialValue: true,
      });

      if (clack.isCancel(confirm) || !confirm) {
        clack.cancel("Split cancelled");
        process.exit(0);
      }
    }

    // Detect current agent setup and recommend directory
    const { detectAgents } = await import("../utils/detect-agents.js");
    const { loadConfig } = await import("@aligntrue/core");
    const config = await loadConfig(undefined, cwd);
    const detectedAgents = detectAgents(cwd);

    let recommendedDir: string;
    let recommendation = "";

    // Context-aware recommendation
    if (config.mode === "team") {
      recommendedDir = ".aligntrue/rules";
      recommendation =
        "Team mode: using .aligntrue/rules for PR review workflow";
    } else if (
      detectedAgents.detected.length === 1 &&
      detectedAgents.detected.includes("cursor")
    ) {
      recommendedDir = ".aligntrue/rules";
      recommendation =
        "Single agent (Cursor): using .aligntrue/rules (you can also use .cursor/rules/*.mdc)";
    } else if (detectedAgents.detected.length > 1) {
      recommendedDir = ".aligntrue/rules";
      recommendation =
        "Multiple agents: using .aligntrue/rules as neutral source";
    } else {
      recommendedDir = ".aligntrue/rules";
      recommendation = "Default: using .aligntrue/rules for organization";
    }

    // Ask for target directory
    let targetDir = recommendedDir;
    if (!yes) {
      clack.log.info(`💡 ${recommendation}\n`);

      const dirInput = await clack.text({
        message: "Target directory for split files?",
        initialValue: recommendedDir,
        placeholder: recommendedDir,
      });

      if (clack.isCancel(dirInput)) {
        clack.cancel("Split cancelled");
        process.exit(0);
      }

      targetDir = dirInput as string;
    } else {
      clack.log.info(`Using recommended directory: ${recommendedDir}`);
    }

    // Check if target directory already has split files
    const targetPath = join(cwd, targetDir);
    if (existsSync(targetPath)) {
      const existingFiles = readdirSync(targetPath).filter((f) =>
        f.endsWith(".md"),
      );
      if (existingFiles.length > 0) {
        clack.log.warn(
          `Target directory already contains ${existingFiles.length} markdown file(s)`,
        );
        if (!yes) {
          const overwrite = await clack.confirm({
            message: "Overwrite existing files?",
            initialValue: false,
          });
          if (clack.isCancel(overwrite) || !overwrite) {
            clack.cancel("Split cancelled");
            process.exit(0);
          }
        } else {
          clack.log.info("Overwriting existing files (--yes mode)");
        }
      }
    }

    // Generate file names preview
    const filePreview: Array<{ filename: string; heading: string }> = [];
    for (const section of parsed.sections) {
      const filename = section.heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      filePreview.push({
        filename: `${filename}.md`,
        heading: section.heading,
      });
    }

    // Show preview of files to be created
    if (!yes) {
      clack.log.info("\nFiles to be created:\n");
      const maxFilePreview = 10;
      for (let i = 0; i < Math.min(filePreview.length, maxFilePreview); i++) {
        console.log(
          `  ${targetDir}/${filePreview[i]!.filename} ← "${filePreview[i]!.heading}"`,
        );
      }
      if (filePreview.length > maxFilePreview) {
        console.log(`  ... and ${filePreview.length - maxFilePreview} more`);
      }
      console.log("");

      const proceedConfirm = await clack.confirm({
        message: "Proceed with file creation?",
        initialValue: true,
      });

      if (clack.isCancel(proceedConfirm) || !proceedConfirm) {
        clack.cancel("Split cancelled");
        process.exit(0);
      }
    }

    // Create target directory (auto-create, no manual step needed)
    mkdirSync(targetPath, { recursive: true });
    clack.log.success(`Created directory: ${targetDir}`);

    // Split sections into files
    const createdFiles: string[] = [];
    for (const section of parsed.sections) {
      // Generate filename from heading
      const filename = section.heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const filePath = join(targetPath, `${filename}.md`);

      // Write section to file
      const fileContent = `# ${section.heading}\n\n${section.content}`;
      writeFileSync(filePath, fileContent, "utf-8");
      createdFiles.push(`${targetDir}/${basename(filePath)}`);

      if (!yes) {
        clack.log.success(`Created ${targetDir}/${basename(filePath)}`);
      }
    }

    if (yes) {
      clack.log.success(
        `Created ${createdFiles.length} files in ${targetDir}/`,
      );
    }

    clack.log.success(`\nSplit ${createdFiles.length} rules to ${targetDir}/`);

    // Backup AGENTS.md to unified backup location
    if (!yes) {
      const backup = await clack.confirm({
        message: "Backup AGENTS.md for safety?",
        initialValue: true,
      });

      if (!clack.isCancel(backup) && backup) {
        const backupPath = backupOverwrittenFile(agentsMdPath, cwd);
        clack.log.info(
          `Backed up AGENTS.md → ${backupPath.replace(cwd + "/", "")}`,
        );
        clack.log.info("You can now delete AGENTS.md if desired");
      }
    } else {
      // In non-interactive mode, always create backup
      const backupPath = backupOverwrittenFile(agentsMdPath, cwd);
      clack.log.info(
        `Backed up AGENTS.md → ${backupPath.replace(cwd + "/", "")}`,
      );
    }

    // Record telemetry
    recordEvent({
      command_name: "sources_split",
      align_hashes_used: [],
    });

    clack.outro(
      "Split complete! Run 'aligntrue sync' to regenerate agent files.",
    );
  } catch (error) {
    clack.log.error(
      `Failed to split sources: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Detect untracked agent files in the workspace
 */
async function detectSources(flags: Record<string, unknown>): Promise<void> {
  const cwd = process.cwd();
  const importFlag = flags["import"] || false;
  const yes = flags["yes"] || false;

  try {
    clack.intro("Detect Untracked Rules");

    // Check if AlignTrue is initialized
    const { getAlignTruePaths, detectNestedAgentFiles, writeRuleFile } =
      await import("@aligntrue/core");
    const paths = getAlignTruePaths(cwd);

    if (!existsSync(paths.aligntrueDir)) {
      clack.log.warn("AlignTrue not initialized. Run 'aligntrue init' first.");
      clack.outro("Done");
      return;
    }

    // Scan for agent files
    clack.log.info("Scanning for agent files...");

    const detectedFiles = await detectNestedAgentFiles(cwd);

    if (detectedFiles.length === 0) {
      clack.log.success("No untracked agent files found.");
      clack.outro("Done");
      return;
    }

    // Group by agent type
    const byType: Record<string, typeof detectedFiles> = {};
    for (const file of detectedFiles) {
      if (!byType[file.type]) {
        byType[file.type] = [];
      }
      byType[file.type]!.push(file);
    }

    // Display found files
    clack.log.info(`Found ${detectedFiles.length} agent file(s):\n`);

    for (const [type, files] of Object.entries(byType)) {
      console.log(`  ${type.toUpperCase()} (${files.length} files)`);
      for (const file of files.slice(0, 5)) {
        console.log(`    - ${file.relativePath}`);
      }
      if (files.length > 5) {
        console.log(`    ... and ${files.length - 5} more`);
      }
      console.log("");
    }

    // If --import flag, import them
    if (importFlag) {
      // Use selective import UI for interactive selection
      const filesForSelection: ImportFile[] = detectedFiles.map((f) => ({
        path: f.path,
        relativePath: f.relativePath,
      }));

      const selectionResult = await selectFilesToImport(filesForSelection, {
        nonInteractive: (yes as boolean) || false,
      });

      if (selectionResult.skipped || selectionResult.selectedFileCount === 0) {
        clack.cancel("Import cancelled");
        process.exit(0);
      }

      // Import using the existing scanner
      const { scanForExistingRules } = await import("./init/rule-importer.js");
      const rules = await scanForExistingRules(cwd);

      if (rules.length === 0) {
        clack.log.warn("No rules could be parsed from detected files.");
        clack.outro("Done");
        return;
      }

      // Write rules to .aligntrue/rules/
      const rulesDir = join(paths.aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });

      const createdFiles: string[] = [];
      for (const rule of rules) {
        const fullPath = join(rulesDir, rule.path);
        const { dirname } = await import("path");
        mkdirSync(dirname(fullPath), { recursive: true });
        writeRuleFile(fullPath, rule);
        createdFiles.push(rule.path);
      }

      clack.log.success(
        `Imported ${createdFiles.length} rules (${selectionResult.selectedFileCount} selected files) to .aligntrue/rules/`,
      );

      // Show first few files
      for (const file of createdFiles.slice(0, 5)) {
        console.log(`  - ${file}`);
      }
      if (createdFiles.length > 5) {
        console.log(`  ... and ${createdFiles.length - 5} more`);
      }

      clack.outro("Run 'aligntrue sync' to update agent files.");
    } else {
      clack.log.info("To import these files, run:");
      console.log("  aligntrue sources detect --import\n");
      clack.outro("Done");
    }

    // Record telemetry
    recordEvent({
      command_name: "sources_detect",
      align_hashes_used: [],
    });
  } catch (error) {
    clack.log.error(
      `Failed to detect sources: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Show help text
 */
function showHelp(): void {
  console.log(`
aligntrue sources - Manage multi-file rule organization

USAGE
  aligntrue sources <subcommand> [options]

SUBCOMMANDS
  list              List all configured sources
  split             Split AGENTS.md into multiple files
  detect            Find untracked agent files in workspace

OPTIONS
  --import          Import detected files (with detect subcommand)
  --yes, -y         Skip confirmation prompts
  --help, -h        Show this help

EXAMPLES
  # List current sources
  aligntrue sources list

  # Find untracked agent files
  aligntrue sources detect

  # Find and import untracked files
  aligntrue sources detect --import

  # Split AGENTS.md into multiple files
  aligntrue sources split

NOTE
  To add external rules:
    aligntrue add <url>              # Copy rules locally
    aligntrue add <url> --link       # Keep connected for updates
  
  For more information: aligntrue sources --help
`);
}

/**
 * Parse command-line flags
 */
function parseFlags(args: string[]): Record<string, unknown> {
  const flags: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--yes" || arg === "-y") {
      flags["yes"] = true;
    } else if (arg === "--help" || arg === "-h") {
      flags["help"] = true;
    } else if (arg === "--import") {
      flags["import"] = true;
    }
  }

  return flags;
}
