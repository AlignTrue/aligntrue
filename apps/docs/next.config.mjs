import nextra from 'nextra';

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  },
  defaultShowCopyCode: true,
  contentDirBasePath: '/docs',
});

export default withNextra({
  output: 'standalone',
  reactStrictMode: true,
});
