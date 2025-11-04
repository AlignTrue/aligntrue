#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DOCS_DIR = join(REPO_ROOT, "apps", "docs");
const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;
const MAX_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 2000;

// ANSI colors for output
const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ ${message}`, colors.blue);
}

function warn(message) {
  log(`⚠ ${message}`, colors.yellow);
}

async function checkServerResponding() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(SERVER_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function getProcessOnPort(port) {
  try {
    const pid = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    return pid || null;
  } catch {
    return null;
  }
}

function killProcess(pid) {
  try {
    execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function cleanNextCache() {
  const nextDir = join(DOCS_DIR, ".next");
  if (existsSync(nextDir)) {
    info("Cleaning stale .next cache...");
    await rm(nextDir, { recursive: true, force: true });
    success("Cache cleaned");
  }
}

function installDependencies() {
  const nodeModules = join(DOCS_DIR, "node_modules");
  if (!existsSync(nodeModules)) {
    info("Installing dependencies...");
    try {
      execSync("pnpm install", { cwd: REPO_ROOT, stdio: "inherit" });
      success("Dependencies installed");
    } catch (err) {
      error("Failed to install dependencies");
      console.error(err);
      process.exit(2);
    }
  }
}

async function startDevServer() {
  return new Promise((resolve, reject) => {
    info("Starting dev server...");
    const child = spawn("pnpm", ["dev"], {
      cwd: DOCS_DIR,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start dev server: ${err.message}`));
    });

    // Don't wait for process to exit, just confirm it started
    setTimeout(() => resolve(child), 1000);
  });
}

async function waitForServer() {
  const startTime = Date.now();
  info(`Waiting for server at ${SERVER_URL}...`);

  while (Date.now() - startTime < MAX_WAIT_MS) {
    if (await checkServerResponding()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

async function main() {
  log("\n🚀 Starting AlignTrue docs server...\n", colors.blue);

  // Step 1: Check if already running
  if (await checkServerResponding()) {
    success(`Server already running at ${SERVER_URL}`);
    log(`\n${colors.green}→ Open ${SERVER_URL} in your browser${colors.reset}\n`);
    process.exit(0);
  }

  // Step 2: Kill zombie processes on port
  const existingPid = getProcessOnPort(PORT);
  if (existingPid) {
    warn(`Found process ${existingPid} on port ${PORT}`);
    if (killProcess(existingPid)) {
      success(`Killed zombie process ${existingPid}`);
      // Wait a moment for port to be released
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      error(`Failed to kill process ${existingPid}`);
      log(
        `\n${colors.yellow}Manual fix required:${colors.reset}\n  kill -9 ${existingPid}\n`
      );
      process.exit(2);
    }
  }

  // Step 3: Check dependencies
  installDependencies();

  // Step 4: Clean cache
  await cleanNextCache();

  // Step 5: Start dev server
  try {
    await startDevServer();
  } catch (err) {
    error(err.message);
    log(
      `\n${colors.yellow}Troubleshooting:${colors.reset}\n` +
        `  1. Check Node version: node -v (need 20+)\n` +
        `  2. Clean install: rm -rf node_modules && pnpm install\n` +
        `  3. Check logs above for build errors\n`
    );
    process.exit(1);
  }

  // Step 6: Wait for server to respond
  if (await waitForServer()) {
    success(`Server ready at ${SERVER_URL}`);
    log(`\n${colors.green}→ Open ${SERVER_URL} in your browser${colors.reset}\n`);
    log(
      `${colors.blue}Press Ctrl+C to stop the server${colors.reset}\n`
    );
    process.exit(0);
  } else {
    error(`Server failed to respond after ${MAX_WAIT_MS / 1000}s`);

    // Provide diagnostics
    const pid = getProcessOnPort(PORT);
    if (pid) {
      warn(`Process ${pid} is on port ${PORT} but not responding`);
    }

    log(
      `\n${colors.yellow}Troubleshooting:${colors.reset}\n` +
        `  1. Check if port ${PORT} is blocked by firewall\n` +
        `  2. Try a different port: PORT=3001 pnpm dev (in apps/docs)\n` +
        `  3. Check build errors in output above\n` +
        `  4. Clean rebuild: rm -rf apps/docs/.next && pnpm start:docs\n` +
        `  5. Check Node version: node -v (need 20+)\n`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(2);
});

