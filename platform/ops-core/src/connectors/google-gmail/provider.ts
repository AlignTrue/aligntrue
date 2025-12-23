import type {
  EmailBodyFetchOpts,
  EmailFetchOpts,
  EmailProvider,
} from "../../providers/email.js";
import { registerEmailProvider } from "../../providers/registry.js";
import { refreshAccessToken, type TokenSet } from "../google-common/token.js";
import { fetchAllGmailMessages, fetchMessageBodies } from "./fetch.js";
import { transformGmailMessages } from "./transform.js";

export class GoogleGmailProvider implements EmailProvider {
  readonly name = "google_gmail";
  readonly supportsMutations = true;

  async fetchMessages(opts: EmailFetchOpts) {
    const raw = await fetchAllGmailMessages(opts);
    return transformGmailMessages(raw);
  }

  async fetchBodies(opts: EmailBodyFetchOpts): Promise<Map<string, string>> {
    return fetchMessageBodies(opts.messageIds, opts.accessToken);
  }

  async refreshToken(token: TokenSet) {
    if (!token.refreshToken) {
      throw new Error("No refresh token provided for Google Gmail");
    }
    return refreshAccessToken({
      refreshToken: token.refreshToken,
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    });
  }
}

// Auto-register on import
registerEmailProvider("google_gmail", new GoogleGmailProvider());
