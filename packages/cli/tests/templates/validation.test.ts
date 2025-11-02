/**
 * Build-time validation tests for starter templates
 * Ensures all templates are generated from canonical source and pass validation
 */

import { describe, it, expect } from "vitest";
import { STARTER_RULES_CANONICAL } from "../../src/templates/starter-rules-canonical.js";
import { getStarterTemplate } from "../../src/templates/starter-rules.js";
import { generateCursorStarter } from "../../src/templates/cursor-starter.js";
import { generateAgentsMdStarter } from "../../src/templates/agents-md-starter.js";
import { validateAlignSchema, validateRuleId } from "@aligntrue/schema";
import { parseYamlToJson } from "@aligntrue/schema";

/**
 * Helper to extract rule IDs from Cursor .mdc format
 */
function extractCursorRuleIds(mdcContent: string): string[] {
  const matches = mdcContent.matchAll(/## Rule: (.+)/g);
  return Array.from(matches, (m) => m[1]);
}

/**
 * Helper to extract rule IDs from AGENTS.md format
 */
function extractAgentsMdRuleIds(agentsMdContent: string): string[] {
  const matches = agentsMdContent.matchAll(/\*\*ID:\*\* (.+)/g);
  return Array.from(matches, (m) => m[1]);
}

describe("Starter templates validation", () => {
  describe("Canonical source", () => {
    it("all rule IDs are valid", () => {
      for (const rule of STARTER_RULES_CANONICAL) {
        const validation = validateRuleId(rule.id);
        if (!validation.valid) {
          console.error(`Invalid rule ID: ${rule.id}`, validation.error);
        }
        expect(validation.valid).toBe(true);
      }
    });

    it("all rules have required fields", () => {
      for (const rule of STARTER_RULES_CANONICAL) {
        expect(rule.id).toBeTruthy();
        expect(rule.id.length).toBeGreaterThan(0);

        expect(rule.severity).toMatch(/^(error|warn|info)$/);

        expect(rule.applies_to).toBeTruthy();
        expect(rule.applies_to.length).toBeGreaterThan(0);

        expect(rule.guidance).toBeTruthy();
        expect(rule.guidance.length).toBeGreaterThan(0);

        expect(rule.tags).toBeTruthy();
        expect(rule.tags.length).toBeGreaterThan(0);
      }
    });

    it("has exactly 5 starter rules", () => {
      expect(STARTER_RULES_CANONICAL.length).toBe(5);
    });

    it("rule IDs are unique", () => {
      const ids = STARTER_RULES_CANONICAL.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("IR template (markdown)", () => {
    it("generates valid IR", () => {
      const template = getStarterTemplate("test-project");

      // Extract YAML from markdown
      const yamlMatch = template.match(/```aligntrue\n([\s\S]+?)\n```/);
      expect(yamlMatch).toBeTruthy();

      const ir = parseYamlToJson(yamlMatch![1]);
      const result = validateAlignSchema(ir, { mode: "solo" });

      if (!result.valid) {
        console.error("IR validation errors:", result.errors);
      }

      expect(result.valid).toBe(true);
    });

    it("uses same rule IDs as canonical source", () => {
      const template = getStarterTemplate("test-project");
      const yamlMatch = template.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(yamlMatch![1]) as any;

      const templateIds = ir.rules.map((r: any) => r.id).sort();
      const canonicalIds = STARTER_RULES_CANONICAL.map((r) => r.id).sort();

      expect(templateIds).toEqual(canonicalIds);
    });

    it("all rule IDs in IR are valid", () => {
      const template = getStarterTemplate("test-project");
      const yamlMatch = template.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(yamlMatch![1]) as any;

      for (const rule of ir.rules) {
        const validation = validateRuleId(rule.id);
        if (!validation.valid) {
          console.error(`Invalid IR rule ID: ${rule.id}`, validation.error);
        }
        expect(validation.valid).toBe(true);
      }
    });

    it("includes project ID in pack ID", () => {
      const template = getStarterTemplate("my-cool-project");
      const yamlMatch = template.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(yamlMatch![1]) as any;

      expect(ir.id).toBe("my-cool-project-rules");
    });

    it("has correct spec version", () => {
      const template = getStarterTemplate("test-project");
      const yamlMatch = template.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(yamlMatch![1]) as any;

      expect(ir.spec_version).toBe("1");
    });
  });

  describe("Cursor template (.mdc)", () => {
    it("uses valid rule IDs", () => {
      const template = generateCursorStarter();
      const ruleIds = extractCursorRuleIds(template);

      expect(ruleIds.length).toBeGreaterThan(0);

      for (const id of ruleIds) {
        const validation = validateRuleId(id);
        if (!validation.valid) {
          console.error(`Invalid Cursor rule ID: ${id}`, validation.error);
        }
        expect(validation.valid).toBe(true);
      }
    });

    it("uses same rule IDs as canonical source", () => {
      const template = generateCursorStarter();
      const templateIds = extractCursorRuleIds(template).sort();
      const canonicalIds = STARTER_RULES_CANONICAL.map((r) => r.id).sort();

      expect(templateIds).toEqual(canonicalIds);
    });

    it("includes YAML frontmatter", () => {
      const template = generateCursorStarter();
      expect(template).toContain("---");
      expect(template).toContain("description:");
      expect(template).toContain("alwaysApply:");
    });

    it("includes all severity levels", () => {
      const template = generateCursorStarter();

      const severities = STARTER_RULES_CANONICAL.map((r) => r.severity);
      for (const severity of severities) {
        expect(template).toContain(`**Severity:** ${severity}`);
      }
    });
  });

  describe("AGENTS.md template", () => {
    it("uses valid rule IDs", () => {
      const template = generateAgentsMdStarter();
      const ruleIds = extractAgentsMdRuleIds(template);

      expect(ruleIds.length).toBeGreaterThan(0);

      for (const id of ruleIds) {
        const validation = validateRuleId(id);
        if (!validation.valid) {
          console.error(`Invalid AGENTS.md rule ID: ${id}`, validation.error);
        }
        expect(validation.valid).toBe(true);
      }
    });

    it("uses same rule IDs as canonical source", () => {
      const template = generateAgentsMdStarter();
      const templateIds = extractAgentsMdRuleIds(template).sort();
      const canonicalIds = STARTER_RULES_CANONICAL.map((r) => r.id).sort();

      expect(templateIds).toEqual(canonicalIds);
    });

    it("includes metadata header", () => {
      const template = generateAgentsMdStarter();
      expect(template).toContain("# AGENTS.md");
      expect(template).toContain("**Version:**");
      expect(template).toContain("**Generated by:** AlignTrue");
    });

    it("uses uppercase severity format", () => {
      const template = generateAgentsMdStarter();

      // AGENTS.md format uses uppercase ERROR, WARN, INFO
      expect(template).toContain("**Severity:** ERROR");
      expect(template).toContain("**Severity:** WARN");
      expect(template).toContain("**Severity:** INFO");
    });
  });

  describe("Template consistency", () => {
    it("all templates have same number of rules", () => {
      const irTemplate = getStarterTemplate("test");
      const irMatch = irTemplate.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(irMatch![1]) as any;
      const irRuleCount = ir.rules.length;

      const cursorTemplate = generateCursorStarter();
      const cursorRuleCount = extractCursorRuleIds(cursorTemplate).length;

      const agentsMdTemplate = generateAgentsMdStarter();
      const agentsMdRuleCount = extractAgentsMdRuleIds(agentsMdTemplate).length;

      const canonicalCount = STARTER_RULES_CANONICAL.length;

      expect(irRuleCount).toBe(canonicalCount);
      expect(cursorRuleCount).toBe(canonicalCount);
      expect(agentsMdRuleCount).toBe(canonicalCount);
    });

    it("all templates use identical rule IDs", () => {
      const irTemplate = getStarterTemplate("test");
      const irMatch = irTemplate.match(/```aligntrue\n([\s\S]+?)\n```/);
      const ir = parseYamlToJson(irMatch![1]) as any;
      const irIds = ir.rules.map((r: any) => r.id).sort();

      const cursorIds = extractCursorRuleIds(generateCursorStarter()).sort();
      const agentsMdIds = extractAgentsMdRuleIds(
        generateAgentsMdStarter(),
      ).sort();
      const canonicalIds = STARTER_RULES_CANONICAL.map((r) => r.id).sort();

      expect(irIds).toEqual(canonicalIds);
      expect(cursorIds).toEqual(canonicalIds);
      expect(agentsMdIds).toEqual(canonicalIds);
    });
  });
});
