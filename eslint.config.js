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

// Custom rule to catch underscore-prefixed variable declaration/usage mismatches
// Only checks within the same function/block scope to avoid false positives
const noUnderscoreMismatch = {
  meta: {
    type: "problem",
    fixable: "code",
    messages: {
      mismatch:
        "Variable '{{name}}' is declared as '{{declaredName}}' but used without underscore. Use '{{declaredName}}' or remove underscore from declaration.",
    },
  },
  create(context) {
    const scopeStack = [];

    return {
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, BlockStatement"(
        node,
      ) {
        scopeStack.push(new Map());
      },
      "FunctionDeclaration:exit"() {
        scopeStack.pop();
      },
      "FunctionExpression:exit"() {
        scopeStack.pop();
      },
      "ArrowFunctionExpression:exit"() {
        scopeStack.pop();
      },
      "BlockStatement:exit"() {
        scopeStack.pop();
      },
      VariableDeclarator(node) {
        if (
          scopeStack.length > 0 &&
          node.id &&
          node.id.name &&
          node.id.name.startsWith("_")
        ) {
          const withoutUnderscore = node.id.name.slice(1);
          const currentScope = scopeStack[scopeStack.length - 1];
          currentScope.set(withoutUnderscore, node.id.name);
        }
      },
      Identifier(node) {
        if (scopeStack.length === 0) return;

        // Skip if this is a declaration
        if (
          node.parent &&
          node.parent.type === "VariableDeclarator" &&
          node.parent.id === node
        ) {
          return;
        }

        // Check if variable was declared with underscore in current scope
        const currentScope = scopeStack[scopeStack.length - 1];
        if (currentScope && currentScope.has(node.name)) {
          const declaredName = currentScope.get(node.name);
          context.report({
            node,
            messageId: "mismatch",
            data: {
              name: node.name,
              declaredName,
            },
            fix(fixer) {
              return fixer.replaceText(node, declaredName);
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
      "archive/**",
      ".archive/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/tests/**/*.ts",
      "archive/**",
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImports,
      "@next/next": nextPlugin,
      "custom-rules": {
        rules: {
          "no-underscore-mismatch": noUnderscoreMismatch,
          "no-asset-imports-in-ui": noAssetImportsInUI,
        },
      },
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
      // Custom rules
      "custom-rules/no-underscore-mismatch": "error",
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off", // Handled by unused-imports
      "@typescript-eslint/no-deprecated": "error", // Block usage of deprecated APIs
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
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "archive/**", "**/tests/**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // Don't use project for test files (they're excluded from tsconfig)
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-deprecated": "off", // Allow deprecated APIs in tests
    },
  },
];
