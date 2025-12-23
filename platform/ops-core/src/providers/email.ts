import type { TokenSet } from "../connectors/google-common/token.js";
import type { EmailMessageRecord } from "../connectors/google-gmail/types.js";

export interface EmailFetchOpts {
  accessToken: string;
  query?: string;
  maxResults?: number;
  includeBody?: boolean;
}

export interface EmailBodyFetchOpts {
  accessToken: string;
  messageIds: string[];
}

export interface EmailProvider {
  readonly name: string;
  readonly supportsMutations: boolean;
  fetchMessages(opts: EmailFetchOpts): Promise<EmailMessageRecord[]>;
  fetchBodies(opts: EmailBodyFetchOpts): Promise<Map<string, string>>;
  refreshToken?(token: TokenSet): Promise<TokenSet>;
}

// Adapter to match the GmailBodyFetcher shape used by email-generator.
export function createBodyFetcher(
  provider: EmailProvider,
  accessToken: string,
): { fetchBodies(ids: string[]): Promise<Map<string, string>> } {
  return {
    fetchBodies: (ids) =>
      provider.fetchBodies({ accessToken, messageIds: ids }),
  };
}
