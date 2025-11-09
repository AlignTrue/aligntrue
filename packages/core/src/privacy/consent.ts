/**
 * Privacy consent manager
 *
 * Handles user consent for network operations (git clones).
 * Consent is stored locally in .aligntrue/privacy-consent.json (git-ignored).
 * Users are prompted once per operation type, not repeatedly.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  ConsentOperation,
  ConsentRecord,
  ConsentStorage,
} from "./types.js";

/**
 * Default consent file location
 */
const DEFAULT_CONSENT_FILE = ".aligntrue/privacy-consent.json";

/**
 * Consent manager for network operations
 */
export class ConsentManager {
  private consentFilePath: string;

  constructor(consentFilePath: string = DEFAULT_CONSENT_FILE) {
    this.consentFilePath = consentFilePath;
  }

  /**
   * Check if consent has been granted for an operation
   */
  checkConsent(operation: ConsentOperation): boolean {
    const storage = this.loadStorage();
    const record = storage[operation];
    return record?.granted === true;
  }

  /**
   * Grant consent for an operation
   * Idempotent - safe to call multiple times
   */
  grantConsent(operation: ConsentOperation, grantedAt?: string): void {
    const storage = this.loadStorage();
    storage[operation] = {
      granted: true,
      granted_at: grantedAt || new Date().toISOString(),
    };
    this.saveStorage(storage);
  }

  /**
   * Revoke consent for a specific operation
   */
  revokeConsent(operation: ConsentOperation): void {
    const storage = this.loadStorage();
    delete storage[operation];
    this.saveStorage(storage);
  }

  /**
   * Revoke all consents
   */
  revokeAll(): void {
    this.saveStorage({});
  }

  /**
   * List all granted consents
   */
  listConsents(): ConsentRecord[] {
    const storage = this.loadStorage();
    return Object.entries(storage).map(([operation, data]) => ({
      operation: operation as ConsentOperation,
      granted: data.granted,
      granted_at: data.granted_at,
    }));
  }

  /**
   * Load consent storage from file
   */
  private loadStorage(): ConsentStorage {
    if (!existsSync(this.consentFilePath)) {
      return {};
    }

    try {
      const content = readFileSync(this.consentFilePath, "utf-8");
      const parsed = JSON.parse(content);

      // Validate structure - must be a plain object (not null, not array)
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return {};
      }

      return parsed as ConsentStorage;
    } catch {
      // Corrupted file - return empty storage
      return {};
    }
  }

  /**
   * Save consent storage to file
   * Note: Using simple writeFileSync since consent is low-frequency and doesn't need
   * full atomic writer complexity. The file is git-ignored and user-specific.
   */
  private saveStorage(storage: ConsentStorage): void {
    const dir = dirname(this.consentFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(storage, null, 2) + "\n";
    writeFileSync(this.consentFilePath, content, "utf-8");
  }

  /**
   * Get the consent file path
   */
  getConsentFilePath(): string {
    return this.consentFilePath;
  }
}

/**
 * Create a consent manager instance
 */
export function createConsentManager(consentFilePath?: string): ConsentManager {
  return new ConsentManager(consentFilePath);
}
