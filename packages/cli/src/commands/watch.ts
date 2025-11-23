/**
 * Watch command - auto-sync on file changes
 */

import { watch as chokidarWatch } from "chokidar";
import * as clack from "@clack/prompts";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { loadConfig, addDriftDetection } from "@aligntrue/core";
import { isTTY } from "../utils/tty-helper.js";
import { detectUntrackedFiles } from "../utils/detect-agents.js";

/**
 * Execute watch command
 */
export async function watch(args: string[]): Promise<void> {
  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Watch agent files and auto-sync on changes\n");
    console.log("Usage: aligntrue watch [options]\n");
    console.log("Options:");
    console.log(
      "  --debounce <ms>  Debounce delay in milliseconds (default: 500)",
    );
    console.log("  -h, --help       Show this help\n");
    console.log("Examples:");
    console.log("  aligntrue watch");
    console.log("  aligntrue watch --debounce 1000");
    console.log("  aligntrue sync --watch  # Alternative syntax");
    return;
  }

  // Check TTY support
  // If non-interactive, we switch to simple logging instead of clack interactive UI
  const interactive = isTTY();

  // TTY is no longer strictly required, but we warn if running in background
  // requireTTY("watch");

  const cwd = process.cwd();
  const configPath = resolve(cwd, ".aligntrue/config.yaml");

  if (!existsSync(configPath)) {
    if (interactive) {
      clack.log.error("Not an AlignTrue project. Run 'aligntrue init' first.");
    } else {
      console.error(
        "Error: Not an AlignTrue project. Run 'aligntrue init' first.",
      );
    }
    process.exit(1);
  }

  // Load config
  const config = await loadConfig(configPath);

  // Parse debounce option
  let debounce = config.sync?.watch_debounce ?? 500;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--debounce") {
      const value = parseInt(args[i + 1] || "500", 10);
      if (!isNaN(value) && value > 0) {
        debounce = value;
      }
    }
  }

  // Determine files to watch
  const watchFiles = config.sync?.watch_files || [
    "AGENTS.md",
    ".cursor/rules/*.mdc",
  ];

  // Resolve watch patterns to absolute paths
  const watchPatterns = watchFiles.map((pattern) => resolve(cwd, pattern));

  if (interactive) {
    clack.intro("AlignTrue Watch Mode");
    clack.log.info(`Watching for changes (debounce: ${debounce}ms)...`);
    watchFiles.forEach((file) => {
      clack.log.info(`  - ${file}`);
    });
  } else {
    console.log("AlignTrue Watch Mode (non-interactive)");
    console.log(`Watching for changes (debounce: ${debounce}ms)...`);
    watchFiles.forEach((file) => {
      console.log(`  - ${file}`);
    });
  }

  // Track sync state
  let syncTimer: NodeJS.Timeout | null = null;
  let isSyncing = false;

  // Debounced sync function
  const triggerSync = async () => {
    if (isSyncing) {
      return;
    }

    isSyncing = true;

    try {
      // Import sync command
      const { sync } = await import("./sync/index.js");

      // Run sync (handles all the complexity internally)
      // Note: Sync might try to use interactive prompts if not configured correctly
      // But in non-TTY environments, it usually detects and switches to non-interactive
      await sync([]);

      if (interactive) {
        clack.log.success(`✓ Synced at ${new Date().toLocaleTimeString()}`);
      } else {
        console.log(`✓ Synced at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      const message = `Sync failed: ${err instanceof Error ? err.message : String(err)}`;
      if (interactive) {
        clack.log.error(message);
      } else {
        console.error(message);
      }
    } finally {
      isSyncing = false;
    }
  };

  // Start watching
  const watcher = chokidarWatch(watchPatterns, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on("change", (path: string) => {
    const relativePath = path.replace(cwd + "/", "");
    if (interactive) {
      clack.log.info(`File changed: ${relativePath}`);
    } else {
      console.log(`File changed: ${relativePath}`);
    }

    // Clear existing timer
    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    // Set new timer
    syncTimer = setTimeout(() => {
      triggerSync();
    }, debounce);
  });

  // Detect new files added
  // Drift log is ONLY created for NEW untracked files detected during watch mode
  // The log is persisted at .aligntrue/.drift-log.json
  // This allows pending imports to persist across watch sessions until handled by 'aligntrue sync'
  watcher.on("add", (path: string) => {
    const relativePath = path.replace(cwd + "/", "");

    // Check if file is tracked in edit_source
    const untrackedFiles = detectUntrackedFiles(cwd, config.sync?.edit_source);
    const isUntracked = untrackedFiles.some(
      (f) => f.relativePath === relativePath,
    );

    if (isUntracked) {
      // Count sections in new file
      try {
        const content = readFileSync(path, "utf-8");
        const sectionCount = (content.match(/^#{1,6}\s+.+$/gm) || []).length;

        if (sectionCount > 0) {
          // Log to drift log
          addDriftDetection(cwd, relativePath, sectionCount, "pending_review");

          if (interactive) {
            clack.log.warn(
              `[Watch] New file detected: ${relativePath} (${sectionCount} sections)`,
            );
            clack.log.info(`  ℹ Run 'aligntrue sync' to review and import`);
          } else {
            console.warn(
              `[Watch] New file detected: ${relativePath} (${sectionCount} sections)`,
            );
            console.info(`  ℹ Run 'aligntrue sync' to review and import`);
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  });

  watcher.on("error", (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (interactive) {
      clack.log.error(`Watcher error: ${message}`);
    } else {
      console.error(`Watcher error: ${message}`);
    }
  });

  // Handle graceful shutdown
  const shutdown = () => {
    if (interactive) {
      clack.log.info("\nShutting down watcher...");
    } else {
      console.log("\nShutting down watcher...");
    }
    watcher.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (interactive) {
    clack.log.success("✓ Watching for changes (Ctrl+C to stop)");
  } else {
    console.log("✓ Watching for changes (Ctrl+C to stop)");
  }
}
