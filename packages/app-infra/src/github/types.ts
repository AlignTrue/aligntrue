export type GitHubFetcher = typeof fetch;

export interface GitHubAppConfig {
  appId: string;
  installationId: string;
  privateKey: string;
}

export interface CachingFetchOptions {
  token?: string;
  ttlSeconds?: number;
  userAgent?: string;
}
