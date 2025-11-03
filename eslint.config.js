import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unusedImports from "eslint-plugin-unused-imports";
import nextPlugin from "@next/eslint-plugin-next";

// Custom rule to prevent asset imports in @aligntrue/ui (zero-build package)
const noAssetImportsInUI = {
  create(context) {
    return {
      ImportDeclaration(node) {
        const filePath = context.filename;

        // Only check files in packages/ui/src
        if (!filePath.includes("packages/ui/src")) {
          return;
        }

        const source = node.source.value;

        // Check if importing an asset file
        const assetExtensions = [
          ".svg",
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".webp",
        ];
        const isAssetImport = assetExtensions.some((ext) =>
          source.endsWith(ext),
        );

        if (isAssetImport) {
          context.report({
            node,
            message: `❌ Asset import forbidden in @aligntrue/ui (zero-build package). Embed SVGs inline as JSX or use data URIs. See implementation_specs.mdc Section 14.`,
            fix(fixer) {
              return null; // Manual fix required
            },
          });
        }
      },
    };
  },
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImports,
      "@next/next": nextPlugin,
    },
    rules: {
      // Unused imports plugin rules
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off", // Handled by unused-imports
      // Next.js rules (configured for app router)
      "@next/next/no-html-link-for-pages": [
        "warn",
        ["apps/web/app", "apps/docs/app"],
      ],
      "@next/next/no-img-element": "warn",
    },
  },
  {
    files: ["packages/ui/src/**/*.{ts,tsx}"],
    rules: {
      "custom-rules/no-asset-imports-in-ui": "error",
    },
    plugins: {
      "custom-rules": {
        rules: {
          "no-asset-imports-in-ui": noAssetImportsInUI,
        },
      },
    },
  },
];
