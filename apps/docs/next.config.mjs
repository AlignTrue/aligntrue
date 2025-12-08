import nextra from "nextra";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
  defaultShowCopyCode: true,
});

export default withNextra({
  output: "export",
  reactStrictMode: true,
  // Transpile workspace packages that export TypeScript source directly
  // Required for @aligntrue/ui which has no build step
  transpilePackages: ["@aligntrue/ui"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/docs",
        permanent: true,
      },
    ];
  },
});
