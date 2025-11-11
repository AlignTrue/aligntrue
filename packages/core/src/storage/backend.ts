/**
 * Storage backend abstraction for AlignTrue
 * Provides unified interface for different storage types: local, repo, remote
 */

import type { AlignSection } from "@aligntrue/schema";

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

/**
 * Local-only storage (never synced)
 * Stores in .aligntrue/.local/
 */
export class LocalStorage implements StorageBackend {
  constructor(
    private cwd: string,
    private scope: string,
  ) {}

  async read(): Promise<AlignSection[]> {
    // TODO: Implement read from .aligntrue/.local/<scope>.yaml
    return [];
  }

  async write(sections: AlignSection[]): Promise<void> {
    // TODO: Implement write to .aligntrue/.local/<scope>.yaml
  }

  async sync(): Promise<void> {
    // No-op for local storage
  }

  getMetadata(): StorageMetadata {
    return {
      type: "local",
      location: `.aligntrue/.local/${this.scope}.yaml`,
    };
  }

  async isAccessible(): Promise<boolean> {
    return true; // Local storage is always accessible
  }
}

/**
 * Repository storage (main repo)
 * Stores in .aligntrue/.rules.yaml
 */
export class RepoStorage implements StorageBackend {
  constructor(
    private cwd: string,
    private scope: string,
  ) {}

  async read(): Promise<AlignSection[]> {
    // TODO: Implement read from .aligntrue/.rules.yaml (filtered by scope)
    return [];
  }

  async write(sections: AlignSection[]): Promise<void> {
    // TODO: Implement write to .aligntrue/.rules.yaml (merge with other scopes)
  }

  async sync(): Promise<void> {
    // No-op for repo storage (git handles this)
  }

  getMetadata(): StorageMetadata {
    return {
      type: "repo",
      location: ".aligntrue/.rules.yaml",
    };
  }

  async isAccessible(): Promise<boolean> {
    return true; // Repo storage is always accessible
  }
}

/**
 * Remote git storage
 * Clones to .aligntrue/.remotes/<scope>/
 */
export class RemoteStorage implements StorageBackend {
  constructor(
    private cwd: string,
    private scope: string,
    private url: string,
    private branch: string = "main",
    private path: string = ".",
  ) {}

  async read(): Promise<AlignSection[]> {
    // TODO: Implement read from .aligntrue/.remotes/<scope>/<path>
    return [];
  }

  async write(sections: AlignSection[]): Promise<void> {
    // TODO: Implement write to .aligntrue/.remotes/<scope>/<path>
  }

  async sync(): Promise<void> {
    // TODO: Implement git pull/push
  }

  getMetadata(): StorageMetadata {
    return {
      type: "remote",
      location: `.aligntrue/.remotes/${this.scope}/${this.path}`,
      url: this.url,
      branch: this.branch,
    };
  }

  async isAccessible(): Promise<boolean> {
    // TODO: Test git connection
    return true;
  }
}
