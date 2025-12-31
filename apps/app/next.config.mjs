const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@aligntrue/ui",
    "@aligntrue/ops-host",
    "@aligntrue/ops-shared-google-gmail",
    "@aligntrue/ops-shared-google-calendar",
    "@aligntrue/ops-shared-google-common",
    "@aligntrue/pack-tasks",
  ],
};

export default nextConfig;
