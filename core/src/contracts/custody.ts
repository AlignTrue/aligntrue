/**
 * Secrets custody contracts. Packs never see raw credentials.
 * Note: named custody.ts to avoid .cursorignore pattern on *secret*.
 */

export type SecretTokenType = "access_token" | "api_key_handle";

export interface SecretAccessReceipt {
  readonly receipt_type: "secret_access";
  readonly capability_id: string;
  readonly token_type: SecretTokenType;
  readonly handle_id?: string; // stable identifier for handles
  readonly secret_id: string; // secret class identifier (not the value)
  readonly audience: string;
  readonly scope: string[];
  readonly issued_at: string;
  readonly expires_at: string;
  readonly requester: string; // ActorRef id
  readonly correlation_id: string;
}

export interface SecretsProvider {
  /**
   * Issue a scoped credential. Returns a handle or short-lived token plus receipt.
   */
  issueScopedCredential(input: {
    capability_id: string;
    secret_id: string;
    audience: string;
    scope: string[];
    correlation_id: string;
    requester: string;
  }): Promise<{
    token_type: SecretTokenType;
    token: string;
    handle_id?: string;
    expires_at: string;
    receipt: SecretAccessReceipt;
  }>;

  /**
   * Revoke a previously issued handle or token.
   */
  revokeHandle(handle_id: string, reason?: string): Promise<void>;
}
