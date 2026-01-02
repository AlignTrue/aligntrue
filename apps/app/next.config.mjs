const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@aligntrue/ui-base",
    "@aligntrue/host",
    "@aligntrue/connector-google-gmail",
    "@aligntrue/connector-google-calendar",
    "@aligntrue/connector-google-common",
    "@aligntrue/pack-tasks",
    "@aligntrue/pack-notes",
    "@aligntrue/pack-suggestions",
    "@aligntrue/ui-blocks",
    "@aligntrue/ui-contracts",
    "@aligntrue/ui-renderer",
  ],
};

export default nextConfig;
