import nextra from 'nextra';

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  },
  defaultShowCopyCode: true,
});

export default withNextra({
  output: 'standalone',
  reactStrictMode: true,
});
