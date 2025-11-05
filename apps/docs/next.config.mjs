import nextra from "nextra";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
  defaultShowCopyCode: true,
});

export default withNextra({
  output: "standalone",
  reactStrictMode: true,
  // Transpile workspace packages that export TypeScript source directly
  // Required for @aligntrue/ui which has no build step
  transpilePackages: ["@aligntrue/ui"],
  // Disable Turbopack - Nextra 4.6.0 has known incompatibility with Turbopack
  // See: https://github.com/shuding/nextra/issues/3428
  experimental: {
    turbo: false,
  },
});
