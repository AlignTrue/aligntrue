---
id: "aligns/base/base-typescript"
version: "1.0.0"
summary: "TypeScript strict mode: tight types, comprehensive checks, input validation at boundaries"
tags: ["typescript", "types", "quality", "paved-road"]
plugs:
  slots:
    tsconfig.file:
      description: "Path to TypeScript configuration file"
      format: file
      required: false
      example: "tsconfig.json"
    lint.cmd:
      description: "Command to run TypeScript type checking"
      format: command
      required: false
      example: "pnpm tsc --noEmit"
# Overlay hints:
# - severity: commonly upgraded to "error" for strict type safety enforcement
# - check.inputs: adjust strictness levels per project needs
---

# TypeScript Strict Mode Guide

TypeScript standards: strict mode, comprehensive type coverage, input validation at boundaries, and minimal `any`.

## Core principles

- **Strict mode is the baseline** - All strict flags enabled
- **Types are documentation** - Keep types clear and obvious
- **Validate at boundaries** - APIs, filesystems, external inputs
- **Avoid `any`** - Use proper types or `unknown`
- **Tight tsconfig** - Minimal escape hatches

## TypeScript Configuration

Recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "esnext",
    "target": "es2020",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Type coverage

- **Public APIs fully typed** - Exported functions, classes, types
- **Avoid `any` at all costs** - Use `unknown` if you must
- **Type function parameters and returns** - No implicit types
- **Type class properties** - Initialize or declare in constructor
- **Export types for public APIs** - Consumers need them

## Validation at Boundaries

**Requirement:** Validate all external inputs.

Boundaries:

- **API endpoints** - Validate request bodies with Zod
- **File I/O** - Parse and validate content
- **Environment variables** - Parse with defaults
- **User input** - Always validate and sanitize
- **Database queries** - Type results

**Pattern:**

```typescript
import { z } from "zod";

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

export async function getUser(data: unknown): User {
  return userSchema.parse(data);
}
```

## Union types and discriminated unions

**Use discriminated unions for error handling:**

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

**Avoid optional boolean:**

```typescript
// ❌ Bad
const result: { isError?: boolean; value?: T } = ...;

// ✅ Good
type Result<T> =
  | { type: "success"; value: T }
  | { type: "error"; error: string };
```

## Type inference

- **Prefer inference** where type is obvious
- **Explicit types** for public APIs
- **Annotate function parameters** - Let returns infer

```typescript
// ✅ Good: infer return type
export function computeHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ✅ Good: explicit for clarity
export function authenticate(token: string): User | null {
  // ...
}
```

## Generics

- **Use sparingly** - Only when needed
- **Constrain generics** - `<T extends Base>`
- **Name clearly** - `T`, `K`, `V` are fine for short functions
- **Document type parameters** in JSDoc

## Any and Unknown

**Never use `any`** unless:

- Legacy migration
- Dynamic JSON with explicit runtime parsing
- Third-party library with poor types

**Use `unknown` instead:**

```typescript
// ❌ Bad
function process(input: any) {
  return input.value;
}

// ✅ Good
function process(input: unknown): string {
  if (typeof input === "object" && input !== null && "value" in input) {
    return String(input.value);
  }
  throw new Error("Invalid input");
}
```

## Const assertions

- **Use `as const`** for literal types
- **Preserve shape** - Arrays, objects, strings
- **Avoid spreading const** - Types widen

```typescript
const DIRECTIONS = ["north", "south", "east", "west"] as const;
type Direction = (typeof DIRECTIONS)[number]; // "north" | "south" | "east" | "west"
```

## ESLint + TypeScript

Recommended rules:

- `@typescript-eslint/no-explicit-any` - Warn
- `@typescript-eslint/no-unused-vars` - Error
- `@typescript-eslint/explicit-function-return-types` - Error for public APIs
- `@typescript-eslint/no-non-null-assertion` - Error (use optional chaining)

## Common patterns

### Optional chaining and nullish coalescing

```typescript
// ✅ Safe property access
const name = user?.profile?.name ?? "Anonymous";

// ❌ Avoid
const name = user!.profile!.name || "Anonymous";
```

### Type narrowing

```typescript
if (typeof input === "string") {
  // input is narrowed to string
}

if (input instanceof Error) {
  // input is narrowed to Error
}
```

### Exhaustive checks

```typescript
function handle(result: Result<T>): void {
  if (result.ok) {
    console.log(result.value);
  } else {
    console.error(result.error);
  }
  // TypeScript ensures all cases covered
}
```

## Type performance

- **Avoid recursive types** - Can slow type-checking
- **Avoid deep unions** - Limit to practical depth
- **Check compilation time** - `tsc --diagnostics`
- **Use `skipLibCheck`** - Trust library types

## Type checking

Run type checking with: `[[plug:lint.cmd]]`

Configure TypeScript in: `[[plug:tsconfig.file]]`
