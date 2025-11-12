/**
 * Storage backend abstraction for AlignTrue
 * Provides unified interface for different storage types: local, repo, remote
 */

import type { AlignSection } from "@aligntrue/schema";

// Type alias for rules (array of sections)
export type Rules = AlignSection[];

// Simple interface for storage backends (used by new implementations)
export interface IStorageBackend {
  read(): Promise<Rules>;
  write(rules: Rules): Promise<void>;
  sync(): Promise<void>;
}

export interface StorageMetadata {
  type: "local" | "repo" | "remote";
  location: string;
  lastSync?: Date;
  url?: string;
  branch?: string;
}

export interface StorageBackend {
  /**
   * Read sections from storage
   */
  read(): Promise<AlignSection[]>;

  /**
   * Write sections to storage
   */
  write(sections: AlignSection[]): Promise<void>;

  /**
   * Sync storage (push/pull for remote, no-op for local/repo)
   */
  sync(): Promise<void>;

  /**
   * Get storage metadata
   */
  getMetadata(): StorageMetadata;

  /**
   * Check if storage is accessible
   */
  isAccessible(): Promise<boolean>;
}
