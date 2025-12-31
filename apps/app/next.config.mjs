const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@aligntrue/ui",
    "@aligntrue/ops-host",
    "@aligntrue/ops-core",
    "@aligntrue/ops-shared-google-gmail",
    "@aligntrue/ops-shared-google-calendar",
    "@aligntrue/ops-shared-google-common",
    "@aligntrue/pack-tasks",
    "@aligntrue/pack-notes",
    "@aligntrue/pack-suggestions",
    "@aligntrue/ui-blocks",
    "@aligntrue/ui-contracts",
    "@aligntrue/ui-renderer",
  ],
};

export default nextConfig;
