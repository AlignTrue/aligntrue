import { describe, expect, test } from "vitest";
import { join } from "path";
import { writeFileSync, readFileSync } from "fs";
import { runAlignTrue } from "../../tests/utils/integration-helpers";
import { assertTestSafety } from "../../tests/comprehensive/test-safety";

describe("Content Deduplication with Normalization", () => {
  assertTestSafety();

  test("detects duplicate content despite formatting differences", async () => {
    const { cleanup, cwd } = await runAlignTrue([
      "init",
      "--yes",
      "--mode",
      "solo",
    ]);

    try {
      // 1. Create initial rules in AGENTS.md
      // We use specific formatting here
      const initialRules = `## Security
Always validate input.

## Testing
Run tests before commit.
`;
      writeFileSync(join(cwd, "AGENTS.md"), initialRules);

      // 2. Sync to establish IR
      await runAlignTrue(["sync"], { cwd });

      // 3. Create new file with identical content but DIFFERENT formatting
      // - Extra blank lines
      // - Extra indentation
      // - Trailing whitespace
      const newRules = `## Security

  Always   validate   input.   

## Documentation
Write docs.
`;
      writeFileSync(join(cwd, "GEMINI.md"), newRules);

      // 4. Sync with auto-enable
      await runAlignTrue(["sync", "--yes"], { cwd });

      // 5. Verify extraction results
      const extractedPath = join(cwd, ".aligntrue/extracted-rules.md");
      const extractedContent = readFileSync(extractedPath, "utf-8");

      // Expect:
      // - Security section SKIPPED (duplicate detected despite formatting)
      // - Documentation section EXTRACTED (new content)

      expect(extractedContent).not.toContain("## Security");
      expect(extractedContent).toContain("## Documentation");
      expect(extractedContent).toContain("Skipped: 1");
      expect(extractedContent).toContain("Extracted: 1");
    } finally {
      cleanup();
    }
  });
});
