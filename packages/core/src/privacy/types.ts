/**
 * Privacy consent types
 */

/**
 * Network operations that require user consent
 */
export type ConsentOperation = "git";

/**
 * Individual consent record
 */
export interface ConsentRecord {
  operation: ConsentOperation;
  granted: boolean;
  granted_at: string;
}

/**
 * Consent storage format
 */
export interface ConsentStorage {
  [operation: string]: {
    granted: boolean;
    granted_at: string;
  };
}
