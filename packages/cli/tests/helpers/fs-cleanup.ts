/**
 * Windows-safe directory cleanup utility
 * Handles EBUSY errors on Windows with retry logic and cwd safety
 */

import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { resolve, sep } from "path";

/**
 * Cleanup directory with retry logic for Windows file locking
 * Windows keeps file handles open longer than Unix, causing EBUSY errors
 * CI environments are particularly aggressive about file locking
 */
export async function cleanupDir(dir: string): Promise<void> {
  const resolvedDir = resolve(dir);
  if (!existsSync(resolvedDir)) return;

  const originalCwd = process.cwd();
  let changedCwd = false;

  // Avoid deleting the current working directory to prevent EBUSY on Windows
  const cwdInsideTarget =
    originalCwd === resolvedDir ||
    originalCwd.startsWith(`${resolvedDir}${sep}`);
  if (cwdInsideTarget) {
    process.chdir(tmpdir());
    changedCwd = true;
  }

  // Windows CI needs retry strategy that fits within 10s hook timeout
  // 8 retries, capped backoff, stays under ~5s total with jitter
  const maxRetries = process.platform === "win32" ? 8 : 1;
  const retryDelay = 100; // ms
  const maxDelay = 800; // ms cap to stay under test timeouts

  for (let i = 0; i < maxRetries; i++) {
    try {
      rmSync(resolvedDir, { recursive: true, force: true });
      if (changedCwd && existsSync(originalCwd)) {
        // Restore cwd when original still exists (not inside deleted tree)
        try {
          process.chdir(originalCwd);
        } catch {
          /* ignore restore failures */
        }
      }
      return;
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === "EBUSY" && i < maxRetries - 1) {
        // Exponential backoff with proper async delay
        // Stays under Vitest's hook timeout with capped backoff + jitter
        const backoff = Math.min(retryDelay * Math.pow(2, i), maxDelay);
        const jitter = Math.floor(Math.random() * 50); // up to 50ms jitter
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, backoff + jitter),
        );
        continue;
      }
      throw err;
    }
  }
}
