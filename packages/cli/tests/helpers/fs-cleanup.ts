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

  // Windows CI needs retry strategy that fits within 10s hook timeout
  // 6 retries with 100ms base = max ~6.3s total (100 * (1+2+4+8+16+32))
  const maxRetries = process.platform === "win32" ? 6 : 1;
  const retryDelay = 100; // ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === "EBUSY" && i < maxRetries - 1) {
        // Exponential backoff with proper async delay
        // Stays under Vitest's 10s hook timeout
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, i)),
        );
        continue;
      }
      throw err;
    }
  }
}
