#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APP_DIR = join(REPO_ROOT, "apps", "app");
const PORT = 3100;
const SERVER_URL = `http://localhost:${PORT}`;
const MAX_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 2000;

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

function getProcessesOnPort(port) {
  try {
    const output = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    if (!output) return [];
    return output.split("\n").filter((pid) => pid.length > 0);
  } catch {
    return [];
  }
}

function killProcess(pid, signal = "SIGTERM") {
  try {
    const killCmd = signal === "SIGKILL" ? `kill -9 ${pid}` : `kill ${pid}`;
    execSync(killCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function killProcessesOnPort(port) {
  const pids = getProcessesOnPort(port);
  if (pids.length === 0) return { killed: [], failed: [] };

  warn(
    `Found ${pids.length} process${pids.length > 1 ? "es" : ""} on port ${port}: ${pids.join(", ")}`,
  );

  const killed = [];
  const failed = [];

  for (const pid of pids) {
    info(`  Attempting to kill PID ${pid} with SIGTERM...`);

    const gracefulKilled = killProcess(pid, "SIGTERM");
    if (gracefulKilled) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const stillRunning = getProcessesOnPort(port).includes(pid);
      if (!stillRunning) {
        success(`  Killed PID ${pid} gracefully`);
        killed.push(pid);
        continue;
      }
      warn(`  PID ${pid} still running after SIGTERM, trying SIGKILL...`);
    }

    const forceKilled = killProcess(pid, "SIGKILL");
    if (forceKilled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const stillRunning = getProcessesOnPort(port).includes(pid);
      if (!stillRunning) {
        success(`  Force killed PID ${pid}`);
        killed.push(pid);
      } else {
        error(`  Failed to kill PID ${pid} even with SIGKILL`);
        failed.push(pid);
      }
    } else {
      error(`  Could not send kill signal to PID ${pid} (permission denied?)`);
      failed.push(pid);
    }
  }

  return { killed, failed };
}

async function cleanCache() {
  const nextDir = join(APP_DIR, ".next");
  const outDir = join(APP_DIR, "out");

  info("Cleaning stale cache...");

  if (existsSync(nextDir)) {
    await rm(nextDir, { recursive: true, force: true });
  }
  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true, force: true });
  }

  success("Cache cleaned");
}

function installDependencies() {
  const nodeModules = join(APP_DIR, "node_modules");
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
    const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
      cwd: APP_DIR,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        PORT: String(PORT),
      },
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start dev server: ${err.message}`));
    });

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
  log("\n🚀 Starting AlignTrue app server...\n", colors.blue);

  if (await checkServerResponding()) {
    success(`Server already running at ${SERVER_URL}`);
    log(`\n${colors.green}→ Open ${SERVER_URL} in your browser${colors.reset}\n`);
    process.exit(0);
  }

  const { killed, failed } = await killProcessesOnPort(PORT);
  if (killed.length > 0) {
    success(
      `Killed ${killed.length} zombie process${killed.length > 1 ? "es" : ""}: ${killed.join(", ")}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (failed.length > 0) {
    error(`Failed to kill process${failed.length > 1 ? "es" : ""}: ${failed.join(", ")}`);
    log(`\n${colors.yellow}Manual fix required:${colors.reset}\n  kill -9 ${failed.join(" ")}\n`);
    process.exit(2);
  }

  installDependencies();
  await cleanCache();

  try {
    await startDevServer();
  } catch (err) {
    error(err.message);
    log(
      `\n${colors.yellow}Troubleshooting:${colors.reset}\n` +
        `  1. Check Node version: node -v (need 20+)\n` +
        `  2. Clean install: rm -rf node_modules && pnpm install\n` +
        `  3. Check logs above for build errors\n`,
    );
    process.exit(1);
  }

  if (await waitForServer()) {
    success(`Server ready at ${SERVER_URL}`);
    log(`\n${colors.green}→ Open ${SERVER_URL} in your browser${colors.reset}\n`);
    log(`${colors.blue}Press Ctrl+C to stop the server${colors.reset}\n`);
  } else {
    error(`Server failed to respond after ${MAX_WAIT_MS / 1000}s`);

    const pids = getProcessesOnPort(PORT);
    if (pids.length > 0) {
      warn(
        `Process${pids.length > 1 ? "es" : ""} ${pids.join(", ")} on port ${PORT} but not responding`,
      );
    }

    log(
      `\n${colors.yellow}Troubleshooting:${colors.reset}\n` +
        `  1. Check if port ${PORT} is blocked by firewall\n` +
        `  2. Try a different port: PORT=3101 pnpm dev (in apps/app)\n` +
        `  3. Check build errors in output above\n` +
        `  4. Clean rebuild: rm -rf apps/app/.next && pnpm start:app\n` +
        `  5. Check Node version: node -v (need 20+)\n`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(2);
});

