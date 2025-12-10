import nextra from "nextra";
import { remarkMermaid } from "@theguild/remark-mermaid";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
  defaultShowCopyCode: true,
  mdxOptions: {
    remarkPlugins: [remarkMermaid],
  },
});

export default withNextra({
  output: "export",
  reactStrictMode: true,
  // Transpile workspace packages that export TypeScript source directly
  // Required for @aligntrue/ui which has no build step
  transpilePackages: ["@aligntrue/ui"],
  experimental: {
    mdxRs: false,
  },
});
