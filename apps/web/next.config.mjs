const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@aligntrue/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "opengraph.githubassets.com",
      },
    ],
  },
};

export default nextConfig;
