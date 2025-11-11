/**
 * Watch command - auto-sync on file changes
 */

import { watch as chokidarWatch } from "chokidar";
import * as clack from "@clack/prompts";
import { resolve } from "path";
import { existsSync } from "fs";
import { loadConfig } from "@aligntrue/core";

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

  const cwd = process.cwd();
  const configPath = resolve(cwd, ".aligntrue/config.yaml");

  if (!existsSync(configPath)) {
    clack.log.error("Not an AlignTrue project. Run 'aligntrue init' first.");
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

  clack.intro("AlignTrue Watch Mode");
  clack.log.info(`Watching for changes (debounce: ${debounce}ms)...`);
  watchFiles.forEach((file) => {
    clack.log.info(`  - ${file}`);
  });

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
      const { sync } = await import("./sync.js");

      // Run sync (handles all the complexity internally)
      await sync([]);

      clack.log.success(`✓ Synced at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      clack.log.error(
        `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
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
    clack.log.info(`File changed: ${relativePath}`);

    // Clear existing timer
    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    // Set new timer
    syncTimer = setTimeout(() => {
      triggerSync();
    }, debounce);
  });

  watcher.on("error", (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    clack.log.error(`Watcher error: ${message}`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    clack.log.info("\nShutting down watcher...");
    watcher.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  clack.log.success("✓ Watching for changes (Ctrl+C to stop)");
}
