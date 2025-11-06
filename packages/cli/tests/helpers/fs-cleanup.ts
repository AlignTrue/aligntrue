/**
 * Windows-safe directory cleanup utility
 * Handles EBUSY errors on Windows with retry logic
 */

import { rmSync, existsSync } from "fs";

/**
 * Cleanup directory with retry logic for Windows file locking
 * Windows keeps file handles open longer than Unix, causing EBUSY errors
 */
export function cleanupDir(dir: string): void {
  if (!existsSync(dir)) return;

  const maxRetries = process.platform === "win32" ? 5 : 1;
  const retryDelay = 50; // ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === "EBUSY" && i < maxRetries - 1) {
        // Wait with exponential backoff on Windows
        const delay = retryDelay * Math.pow(2, i);
        // Use synchronous sleep via busy wait (acceptable for tests)
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      }
      throw err;
    }
  }
}
