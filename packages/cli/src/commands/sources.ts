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
import { loadConfig, saveConfig } from "@aligntrue/core";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";

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
    case "add":
      // Helpful error for users trying to add packs
      console.error(`Error: 'sources add' is not a valid command\n`);
      console.error(`To add external packs or rules:\n`);
      console.error(`  Edit .aligntrue/config.yaml and add to sources:`);
      console.error(`     sources:`);
      console.error(`       - type: git`);
      console.error(`         url: https://github.com/yourorg/rules`);
      console.error(`         path: rules.yaml\n`);
      console.error(`For more help: aligntrue sources --help`);
      process.exit(2);
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
 * List all source files with section counts
 */
async function listSources(_flags: Record<string, unknown>): Promise<void> {
  const cwd = process.cwd();

  try {
    clack.intro("Source files");

    // Load config
    const config = await loadConfig(undefined, cwd);

    // Get source file patterns (now from edit_source)
    const editSource = config.sync?.edit_source || "AGENTS.md";
    // If edit_source is array or wildcard, it's a multi-file source
    const isArray = Array.isArray(editSource);
    const hasWildcard =
      typeof editSource === "string" &&
      (editSource.includes("*") ||
        editSource.includes("?") ||
        editSource.includes("["));

    const sourceFiles = isArray || hasWildcard ? editSource : "AGENTS.md";
    const sourceOrder = config.sync?.source_order;

    // Display configuration
    clack.log.info(
      `Source patterns: ${Array.isArray(sourceFiles) ? sourceFiles.join(", ") : sourceFiles}`,
    );
    if (sourceOrder && sourceOrder.length > 0) {
      clack.log.info(`Custom order: ${sourceOrder.join(", ")}`);
    }

    // Discover actual files
    const { discoverSourceFiles, orderSourceFiles } = await import(
      "@aligntrue/core"
    );
    const discovered = await discoverSourceFiles(cwd, config);
    const ordered = orderSourceFiles(discovered, sourceOrder);

    if (ordered.length === 0) {
      clack.log.warn("No source files found");
      clack.outro("Done");
      return;
    }

    // Analyze file sizes
    const { analyzeFiles, getLargeFiles } = await import(
      "../utils/file-size-detector.js"
    );

    const filesToAnalyze = ordered.map((file) => ({
      path: join(cwd, file.path),
      relativePath: file.path,
    }));

    const analyses = analyzeFiles(filesToAnalyze);
    const largeFiles = getLargeFiles(analyses);

    // Display files with section counts and sizes
    clack.log.success(
      `Found ${ordered.length} source file${ordered.length !== 1 ? "s" : ""}:\n`,
    );

    for (let i = 0; i < ordered.length; i++) {
      const file = ordered[i]!;
      const analysis = analyses[i]!;
      const sectionCount = file.sections.length;

      let icon = "  ";
      if (analysis.severity === "urgent") {
        icon = "⚠️ ";
      } else if (analysis.severity === "warning") {
        icon = "💡";
      }

      console.log(
        `  ${icon} ${file.path} (${sectionCount} section${sectionCount !== 1 ? "s" : ""}, ${analysis.lineCount} lines)`,
      );
    }

    // Show recommendations if there are large files
    if (largeFiles.length > 0) {
      console.log("");
      clack.log.info("💡 Recommendations:");

      for (const large of largeFiles) {
        if (large.severity === "urgent") {
          console.log(
            `   ${large.relativePath}: File is very large (${large.lineCount} lines)`,
          );
        } else {
          console.log(
            `   ${large.relativePath}: File is getting large (${large.lineCount} lines)`,
          );
        }
      }

      console.log("\n   Consider splitting large files:");
      console.log("   aligntrue sources split");
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

    // Update config
    const configToUpdate = await loadConfig(undefined, cwd);
    configToUpdate.sync = configToUpdate.sync || {};
    configToUpdate.sync.edit_source = `${targetDir}/*.md`;
    await saveConfig(configToUpdate, undefined, cwd);

    clack.log.success(
      `\nUpdated config: sync.edit_source = "${targetDir}/*.md"`,
    );

    // Ask about backing up AGENTS.md
    if (!yes) {
      const backup = await clack.confirm({
        message: "Move AGENTS.md to AGENTS.md.bak?",
        initialValue: true,
      });

      if (!clack.isCancel(backup) && backup) {
        const backupPath = join(cwd, "AGENTS.md.bak");
        writeFileSync(backupPath, content, "utf-8");
        // Don't delete AGENTS.md yet - let user do it manually
        clack.log.info("Backed up AGENTS.md → AGENTS.md.bak");
        clack.log.info("You can now delete AGENTS.md if desired");
      }
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
 * Show help text
 */
function showHelp(): void {
  console.log(`
aligntrue sources - Manage multi-file rule organization

USAGE
  aligntrue sources <subcommand> [options]

SUBCOMMANDS
  list              List all source files with section counts
  split             Split AGENTS.md into multiple files

OPTIONS
  --yes, -y         Skip confirmation prompts
  --help, -h        Show this help

EXAMPLES
  # List current source files
  aligntrue sources list

  # Split AGENTS.md into multiple files
  aligntrue sources split

  # Split without prompts
  aligntrue sources split --yes

NOTE
  The 'sources' command is for organizing your own rules into multiple files.
  
  To add external packs or rules from git repositories:
    - Edit .aligntrue/config.yaml and add to sources array
    - Use type: git with url and optional path fields
  
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
    }
  }

  return flags;
}
