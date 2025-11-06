/**
 * Starter template for AlignTrue rules
 * Generated from canonical source to ensure consistency
 */

import { STARTER_RULES_CANONICAL } from "./starter-rules-canonical.js";
import * as yaml from "yaml";

/**
 * Get the comprehensive starter template
 * Generated from canonical rules source
 */
export function getStarterTemplate(projectId: string = "my-project"): string {
  // Build pack from canonical rules
  const pack = {
    id: `${projectId}-rules`,
    version: "1.0.0",
    spec_version: "1",
    rules: STARTER_RULES_CANONICAL.map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      applies_to: rule.applies_to,
      guidance: rule.guidance,
      tags: rule.tags,
      ...(rule.vendor && { vendor: rule.vendor }),
    })),
  };

  // Generate YAML
  const yamlContent = yaml.stringify(pack, {
    lineWidth: 0, // Don't wrap long lines
    indent: 2,
  });

  return `# AlignTrue Rules

Welcome! This file contains rules for your AI coding assistants.

AlignTrue syncs these rules to all your agents (Cursor, VS Code, Copilot, etc.) 
so they work consistently across your project.

## How it works

1. Edit the rules below to match your project needs
2. Run \`aligntrue sync\` to update your agent configs
3. Your AI assistants will follow these rules automatically

---

\`\`\`aligntrue
${yamlContent.trim()}
\`\`\`

---

## Next steps

1. **Customize these rules** - Edit the rules above to match your project
2. **Add more rules** - Copy a rule block and modify it
3. **Run sync** - \`aligntrue sync\` to update your agent configs
4. **Learn more** - https://aligntrue.ai/docs

## Rule format reference

Each rule has:
- **id**: Unique identifier (e.g., \`quality.testing.required\`)
- **severity**: \`error\` | \`warn\` | \`info\`
- **applies_to**: File patterns (glob syntax)
- **guidance**: Instructions for AI assistants
- **tags**: Optional categorization
- **check**: Optional machine-checkable validation
- **vendor**: Optional agent-specific metadata

Enjoy coding with aligned AI assistants!
`;
}
