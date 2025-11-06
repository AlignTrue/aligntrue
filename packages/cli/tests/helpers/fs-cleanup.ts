/**
 * Windows-safe directory cleanup utility
 * Handles EBUSY errors on Windows with retry logic
 */

import { rmSync, existsSync } from "fs";

/**
 * Cleanup directory with retry logic for Windows file locking
 * Windows keeps file handles open longer than Unix, causing EBUSY errors
 * CI environments are particularly aggressive about file locking
 */
export async function cleanupDir(dir: string): Promise<void> {
  if (!existsSync(dir)) return;

  // Windows CI needs more aggressive retry strategy
  const maxRetries = process.platform === "win32" ? 10 : 1;
  const retryDelay = 100; // ms - doubled for CI environments

  for (let i = 0; i < maxRetries; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === "EBUSY" && i < maxRetries - 1) {
        // Exponential backoff with proper async delay
        // Max delay: 100 * 2^9 = 51.2 seconds (but typically resolves in 1-2 retries)
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, i)),
        );
        continue;
      }
      throw err;
    }
  }
}
