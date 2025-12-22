import { Connectors } from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

const { GoogleCommon } = Connectors;
type TokenSet = Connectors.GoogleCommon.TokenSet;

export interface SyncTokenOptions {
  allowRefresh?: boolean;
}

export async function loadTokenSet(
  opts: SyncTokenOptions = {},
): Promise<TokenSet> {
  const tokens = GoogleCommon.getTokenFromEnv();
  if (
    opts.allowRefresh !== false &&
    tokens.refreshToken &&
    GoogleCommon.isTokenExpiringSoon(tokens.expiresAt)
  ) {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    if (clientId && clientSecret) {
      const refreshed = await GoogleCommon.refreshAccessToken({
        refreshToken: tokens.refreshToken,
        clientId,
        clientSecret,
      });
      // Persist refreshed token in-memory for this process.
      process.env["GOOGLE_ACCESS_TOKEN"] = refreshed.accessToken;
      if (refreshed.expiresAt) {
        process.env["GOOGLE_TOKEN_EXPIRES_AT"] = String(refreshed.expiresAt);
      }
      return refreshed;
    }
  }
  return tokens;
}

export function logSection(title: string): void {
  console.log(title);
}

export function logKV(label: string, value: string | number): void {
  console.log(`  ${label}: ${value}`);
}

export function parseDaysArg(args: string[], defaultValue: number): number {
  const daysArg = args.find((a) => a.startsWith("--days="));
  if (!daysArg) return defaultValue;

  const parsed = Number.parseInt(daysArg.split("=")[1] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    exitWithError(2, "Invalid --days value: expected positive integer");
  }
  return parsed;
}
