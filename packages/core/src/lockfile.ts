/**
 * Lockfile operations with hash modes (off/soft/strict)
 */

export type LockfileMode = 'off' | 'soft' | 'strict';

export interface Lockfile {
  version: string;
  mode: LockfileMode;
  hashes: Record<string, string>;
  generated: string;
}

export async function readLockfile(path: string): Promise<Lockfile | null> {
  throw new Error('Not implemented');
}

export async function writeLockfile(path: string, lockfile: Lockfile): Promise<void> {
  throw new Error('Not implemented');
}

export async function verifyLockfile(path: string, mode: LockfileMode): Promise<boolean> {
  throw new Error('Not implemented');
}

