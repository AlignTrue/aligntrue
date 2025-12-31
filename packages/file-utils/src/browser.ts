/**
 * Browser-only stub for file utils.
 * These utilities are server-only; in the browser we throw to avoid accidental use.
 */
export class AtomicFileWriter {
  async write(): Promise<void> {
    throw new Error("AtomicFileWriter is not available in the browser");
  }

  rollback(): void {
    throw new Error("AtomicFileWriter is not available in the browser");
  }

  getChecksum(): undefined {
    return undefined;
  }

  trackFile(): void {
    throw new Error("AtomicFileWriter is not available in the browser");
  }

  clear(): void {
    // no-op
  }
}

export function ensureDirectoryExists(): void {
  throw new Error("ensureDirectoryExists is not available in the browser");
}

export function computeFileChecksum(): never {
  throw new Error("computeFileChecksum is not available in the browser");
}

export function computeContentChecksum(content: string): string {
  // Return a stable value to avoid undefined access patterns.
  return content;
}
