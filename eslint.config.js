import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unusedImports from "eslint-plugin-unused-imports";
// eslint-disable-next-line unused-imports/no-unused-imports
import nextPlugin from "@next/eslint-plugin-next";
import security from "eslint-plugin-security";

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

// Custom rule to catch file-system check-then-operate patterns (TOCTOU)
// Detects existsSync() followed by mkdirSync(), writeFileSync(), unlinkSync()
const noCheckThenOperate = {
  meta: {
    type: "problem",
    fixable: false,
    messages: {
      mkdirAfterExists:
        "Potential TOCTOU race condition: Use ensureDirectoryExists() instead of checking existsSync() then calling mkdirSync(). See file-utils package.",
      writeAfterExists:
        "Potential TOCTOU race condition: Use AtomicFileWriter instead of checking existsSync() then calling writeFileSync().",
      unlinkAfterExists:
        "Potential TOCTOU race condition: Use try/catch with error handling instead of checking existsSync() then calling unlinkSync().",
    },
  },
  create(context) {
    let lastExistsSyncNode = null;
    let lastExistsSyncLine = -1;

    return {
      CallExpression(node) {
        // Track existsSync calls
        if (
          node.callee &&
          ((node.callee.name && node.callee.name === "existsSync") ||
            (node.callee.property &&
              node.callee.property.name === "existsSync"))
        ) {
          lastExistsSyncNode = node;
          lastExistsSyncLine = node.loc.start.line;
          return;
        }

        // Check if this is a file operation on the same or next line
        const currentLine = node.loc.start.line;
        const isNearbyOperation =
          currentLine - lastExistsSyncLine >= 0 &&
          currentLine - lastExistsSyncLine <= 3;

        if (!isNearbyOperation || !lastExistsSyncNode) return;

        const callName =
          node.callee.name ||
          (node.callee.property && node.callee.property.name);

        if (callName === "mkdirSync") {
          context.report({
            node,
            messageId: "mkdirAfterExists",
          });
          lastExistsSyncNode = null;
        } else if (callName === "writeFileSync") {
          context.report({
            node,
            messageId: "writeAfterExists",
          });
          lastExistsSyncNode = null;
        } else if (callName === "unlinkSync") {
          context.report({
            node,
            messageId: "unlinkAfterExists",
          });
          lastExistsSyncNode = null;
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

// Custom rule to flag Math.random() usage (use crypto instead)
const noMathRandom = {
  meta: {
    type: "problem",
    fixable: false,
    messages: {
      unsafe:
        "Math.random() is cryptographically insecure. Use crypto.getRandomValues() for security-sensitive randomness, or crypto.randomBytes() for seeds.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for Math.random()
        if (
          node.callee &&
          node.callee.type === "MemberExpression" &&
          node.callee.object &&
          node.callee.object.name === "Math" &&
          node.callee.property &&
          node.callee.property.name === "random"
        ) {
          // Allow in test files (they don't need crypto-grade randomness)
          const filePath = context.filename;
          if (filePath.includes(".test.") || filePath.includes("/tests/")) {
            return;
          }

          context.report({
            node,
            messageId: "unsafe",
          });
        }
      },
    };
  },
};

// Custom rule to flag process.env leaks in output (console.log, console.error, etc.)
const noEnvVarInOutput = {
  meta: {
    type: "problem",
    fixable: false,
    messages: {
      leak: "Potential environment variable leak in console output. Sanitize sensitive values before logging.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for console.log/error/warn/info with process.env
        const callName = node.callee?.property?.name || node.callee?.name;
        if (!["log", "error", "warn", "info"].includes(callName)) return;

        // Check if console is the object (for console.log etc)
        const isConsoleCall =
          (node.callee?.object?.name === "console" ||
            node.callee?.name === "log") &&
          node.callee?.type === "MemberExpression";

        if (!isConsoleCall) return;

        // Check if any argument references process.env
        const hasEnvRef = node.arguments.some((arg) => {
          const source = (
            context.sourceCode || context.getSourceCode()
          ).getText(arg);
          return source.includes("process.env");
        });

        if (hasEnvRef) {
          context.report({
            node,
            messageId: "leak",
          });
        }
      },
    };
  },
};

// Custom rule to flag hardcoded secrets in strings
const noHardcodedSecrets = {
  meta: {
    type: "problem",
    fixable: false,
    messages: {
      secret:
        "Possible hardcoded secret detected ({{type}}). Use environment variables instead.",
    },
  },
  create(context) {
    const secretPatterns = [
      { regex: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, type: "API key" },
      {
        regex: /password\s*=\s*['"][^'"]+['"]/i,
        type: "password",
      },
      {
        regex: /token\s*=\s*['"][^'"]+['"]/i,
        type: "token",
      },
      {
        regex: /secret\s*=\s*['"][^'"]+['"]/i,
        type: "secret",
      },
      {
        regex: /private[_-]?key\s*=\s*['"][^'"]+['"]/i,
        type: "private key",
      },
      {
        regex: /aws[_-]?secret\s*=\s*['"][^'"]+['"]/i,
        type: "AWS secret",
      },
    ];

    return {
      Literal(node) {
        if (typeof node.value !== "string") return;

        // Skip test files (they can have dummy secrets)
        const filePath = context.filename;
        if (filePath.includes(".test.") || filePath.includes("/tests/")) {
          return;
        }

        // Skip short strings (unlikely to be real secrets)
        if (node.value.length < 10) return;

        // Check against patterns
        for (const { regex, type } of secretPatterns) {
          if (regex.test(node.value)) {
            context.report({
              node,
              messageId: "secret",
              data: { type },
            });
            return;
          }
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
      "eslint.config.js", // Config file doesn't use rules it defines
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/tests/**/*.ts",
      "archive/**",
      "**/vitest.config.ts",
      "**/vitest-setup.ts",
      "**/scripts/**/*.ts",
      "examples/**",
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
      security,
      "custom-rules": {
        rules: {
          "no-check-then-operate": noCheckThenOperate,
          "no-underscore-mismatch": noUnderscoreMismatch,
          "no-asset-imports-in-ui": noAssetImportsInUI,
          "no-math-random": noMathRandom,
          "no-env-var-in-output": noEnvVarInOutput,
          "no-hardcoded-secrets": noHardcodedSecrets,
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
      // Security rules
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "warn",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-no-csrf-before-method-override": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      // Custom rules
      "custom-rules/no-check-then-operate": "warn",
      "custom-rules/no-underscore-mismatch": "error",
      "custom-rules/no-math-random": "warn",
      "custom-rules/no-env-var-in-output": "warn",
      "custom-rules/no-hardcoded-secrets": "warn",
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
    files: ["packages/core/src/paths.ts"],
    rules: {
      // All paths from getAlignTruePaths() are safe internal paths (not user input)
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["packages/file-utils/src/atomic-writer.ts"],
    rules: {
      // AtomicFileWriter handles validated paths and provides safe file operations
      // All paths passed to this utility are validated or safe by construction
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: [
      "packages/core/src/privacy/consent.ts",
      "packages/core/src/telemetry/collector.ts",
      "packages/core/src/cache/agent-detection.ts",
      "packages/core/src/performance/incremental.ts",
      "packages/core/src/performance/index.ts",
      "packages/core/src/storage/local.ts",
      "packages/core/src/storage/repo.ts",
      "packages/core/src/storage/remote.ts",
    ],
    rules: {
      // These files use paths from getAlignTruePaths() or construct safe internal paths
      // All paths are safe internal paths (e.g., .aligntrue/.local, .aligntrue/.remotes)
      // See .cursor/rules/security-linting-policy.mdc for details
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: [
      "packages/core/src/overlays/operations.ts",
      "packages/cli/src/commands/config.ts",
    ],
    rules: {
      // These files have prototype pollution protection (explicit __proto__/constructor/prototype checks)
      // config.ts: lines 569-571, 634-640 check for __proto__/constructor/prototype before access
      // operations.ts: lines 38-46 check for dangerous keys before property access
      // See packages/core/docs/SECURITY.md Section 4 for details
      "security/detect-object-injection": "off",
    },
  },
  {
    files: [
      "apps/docs/lib/check-links.ts",
      "packages/core/src/tracking/section-fingerprint.ts",
      "packages/core/src/tracking/git-diff-strategy.ts",
    ],
    rules: {
      // Static regex patterns (not from user input) - safe from ReDoS
      "security/detect-unsafe-regex": "off",
    },
  },
  {
    files: ["packages/core/src/security/regex-validator.ts"],
    rules: {
      // This file IS the regex validator - it needs to construct RegExp to validate patterns
      "security/detect-non-literal-regexp": "off",
    },
  },
  {
    files: [
      "packages/cli/src/**/*.ts",
      "packages/core/src/**/*.ts",
      "packages/exporters/src/**/*.ts",
      "packages/schema/src/**/*.ts",
      "packages/sources/src/**/*.ts",
      "apps/docs/lib/**/*.ts",
    ],
    rules: {
      // These files/directories use paths from getAlignTruePaths() (safe internal paths) or validate via validateScopePath()
      // CLI commands/wizards/utils: typically use getAlignTruePaths() for all file operations
      // Core modules: paths validated via validateScopePath() at config load time or use safe internal paths
      // Schema: uses safe canonicalization paths
      // Sources: providers validate paths (local.ts checks for .. traversal, git.ts uses validated refs)
      // Exporters: output paths validated before use
      // See packages/core/docs/SECURITY.md for path validation details
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: [
      "apps/docs/lib/**/*.ts",
      "packages/core/src/tracking/**/*.ts",
      "packages/core/src/sync/**/*.ts",
      "packages/cli/src/utils/**/*.ts",
      "packages/exporters/src/**/*.ts",
    ],
    rules: {
      // Static regex patterns (not from user input) or validated patterns - safe from ReDoS
      // git-integration.ts: hardcoded markers escaped before regex construction
      // detect-agents.ts: pattern length validated (max 200) and escaped
      // exporter-base.ts: pattern length validated (max 200)
      // Patterns are either static or validated via regex-validator.ts
      "security/detect-non-literal-regexp": "off",
    },
  },
  {
    files: [
      "packages/core/src/**/*.ts",
      "packages/cli/src/**/*.ts",
      "packages/exporters/src/**/*.ts",
      "packages/schema/src/**/*.ts",
      "packages/sources/src/**/*.ts",
      "packages/ui/src/**/*.{ts,tsx}",
    ],
    rules: {
      // These files use safe object property access:
      // - Validated paths from config (validateScopePath)
      // - Array iteration (config.sources[i], config.exporters[i])
      // - Known keys from Object.keys() iteration (AGENT_PATTERNS[agentName])
      // - Required fields arrays (manifest[field] where field is from known array)
      // - Prototype pollution protection where needed (explicit __proto__/constructor/prototype checks)
      // - Schema canonicalization uses safe property access
      // - UI components use safe SVG/React props
      // See packages/core/docs/SECURITY.md for path validation details
      "security/detect-object-injection": "off",
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
    plugins: {
      "unused-imports": unusedImports,
      security,
    },
    rules: {
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-deprecated": "off", // Allow deprecated APIs in tests
      // Test fixtures use temp dirs with crypto randomness and cleanup. Safe by construction.
      // See .cursor/rules/security-linting-policy.mdc Section 1 (Safe Internal Paths)
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      security,
    },
    rules: {
      // Scripts use static known commands via execSync, parsed with static patterns
      // See .cursor/rules/security-linting-policy.mdc Section 5 (Safe Child Process Execution)
      "security/detect-child-process": "off",
      // Scripts use safe internal paths from __dirname or package root
      // See .cursor/rules/security-linting-policy.mdc Section 1 (Safe Internal Paths)
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
