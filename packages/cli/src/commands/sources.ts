/**
 * Source file management commands
 * List, split, and manage multi-file rule organization
 */

import * as clack from "@clack/prompts";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { loadConfig, saveConfig } from "@aligntrue/core";
// Telemetry placeholder - not implemented yet
async function recordEvent(_event: {
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  // Telemetry is implemented in other commands via @aligntrue/core/telemetry
  // Can be added here when needed
  return Promise.resolve();
}

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

    // Get source file patterns
    const sourceFiles = config.sync?.source_files || "AGENTS.md";
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

    // Display files with section counts
    clack.log.success(
      `Found ${ordered.length} source file${ordered.length !== 1 ? "s" : ""}:\n`,
    );
    for (const file of ordered) {
      const sectionCount = file.sections.length;
      console.log(
        `  ${file.path} (${sectionCount} section${sectionCount !== 1 ? "s" : ""})`,
      );
    }

    // Record telemetry
    await recordEvent({
      event: "sources_list",
      properties: {
        file_count: ordered.length,
      },
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

    // Show sections
    clack.log.info(`Found ${parsed.sections.length} sections in AGENTS.md:\n`);
    for (const section of parsed.sections) {
      console.log(`  - ${section.heading}`);
    }

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

    // Ask for target directory
    let targetDir = "rules";
    if (!yes) {
      const dirInput = await clack.text({
        message: "Target directory for split files?",
        initialValue: "rules",
        placeholder: "rules",
      });

      if (clack.isCancel(dirInput)) {
        clack.cancel("Split cancelled");
        process.exit(0);
      }

      targetDir = dirInput as string;
    }

    // Create target directory
    const targetPath = join(cwd, targetDir);
    mkdirSync(targetPath, { recursive: true });

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

      clack.log.success(`Created ${targetDir}/${basename(filePath)}`);
    }

    // Update config
    const config = await loadConfig(undefined, cwd);
    config.sync = config.sync || {};
    config.sync.source_files = `${targetDir}/*.md`;
    await saveConfig(config, undefined, cwd);

    clack.log.success(
      `\nUpdated config: sync.source_files = "${targetDir}/*.md"`,
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
    await recordEvent({
      event: "sources_split",
      properties: {
        section_count: parsed.sections.length,
        target_dir: targetDir,
      },
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
