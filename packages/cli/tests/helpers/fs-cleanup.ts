/**
 * Windows-safe directory cleanup utility
 * Handles EBUSY errors on Windows with retry logic
 */

import { rmSync, existsSync } from "fs";

/**
 * Cleanup directory with retry logic for Windows file locking
 * Windows keeps file handles open longer than Unix, causing EBUSY errors
 */
export async function cleanupDir(dir: string): Promise<void> {
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
        // Proper async delay that yields to OS
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, i)),
        );
        continue;
      }
      throw err;
    }
  }
}
