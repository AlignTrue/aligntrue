#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const processes = [];

function spawnTask(name, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });

  child.name = name;
  processes.push(child);

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`${name} exited via signal ${signal}`);
    } else {
      console.log(`${name} exited with code ${code}`);
    }
    // If one task exits, stop the others and mirror its code.
    killAll(child.pid);
    process.exit(code ?? 1);
  });

  child.on("error", (err) => {
    console.error(`${name} failed to start: ${err.message}`);
    killAll(child.pid);
    process.exit(1);
  });

  return child;
}

function killAll(excludePid) {
  for (const child of processes) {
    if (child.pid === excludePid) continue;
    try {
      child.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }
}

function setupSignalHandlers() {
  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}, stopping dev tasks...`);
    killAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function main() {
  console.log("Starting AlignTrue dev stack (packages watch + app)...");
  setupSignalHandlers();

  spawnTask("packages:watch", "pnpm", ["dev:packages"]);
  spawnTask("app", "pnpm", ["--filter", "@aligntrue/app", "dev"]);
}

main();
