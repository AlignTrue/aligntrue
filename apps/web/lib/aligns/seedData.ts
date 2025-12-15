import type { CachedContent } from "./content-cache";
import type { AlignRecord } from "./types";

type CachedPackContent = Extract<CachedContent, { kind: "pack" }>;
type SeedEntry = { record: AlignRecord; content: CachedContent };

const encoder = new TextEncoder();

const topics = [
  "security",
  "frontend",
  "backend",
  "testing",
  "performance",
  "accessibility",
  "devops",
  "data",
  "infra",
];

const stacks = [
  "react",
  "nextjs",
  "node",
  "typescript",
  "python",
  "golang",
  "rust",
  "java",
  "kotlin",
  "swift",
  "dart",
  "php",
];

const licenses = ["MIT", "Apache-2.0", "BSD-3-Clause", "MPL-2.0"];

function byteLength(str: string): number {
  return encoder.encode(str).length;
}

function makeRuleContent(title: string, topic: string, stack: string) {
  return `# ${title}

- Enforces ${topic} patterns for ${stack} projects.
- Ready to export to Cursor, AGENTS.md, Claude, Gemini, Copilot, and more.
- Includes quickstart commands for aligntrue sync and add source.
`;
}

function makePackFiles(
  title: string,
  topic: string,
  stack: string,
): CachedPackContent {
  const base = `# ${title}
- Base ${topic} rules for ${stack}
- Security, lint, and DX defaults
`;
  const quality = `# Quality rules
- Naming, formatting, and testing expectations
- PR review checklist items
`;
  const overlays = `# Team overlays
- Severity tuning for ${stack}
- Allowlist/denylist examples
`;

  return {
    kind: "pack",
    files: [
      { path: "rules/base.md", size: byteLength(base), content: base },
      {
        path: "rules/quality.md",
        size: byteLength(quality),
        content: quality,
      },
      {
        path: "overlays/team.md",
        size: byteLength(overlays),
        content: overlays,
      },
    ],
  };
}

function buildSeeds(): SeedEntry[] {
  const entries: SeedEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 72; i += 1) {
    const topic = topics[i % topics.length];
    const stack = stacks[(i * 3) % stacks.length];
    const license = licenses[i % licenses.length];
    const isPack = i % 6 === 0; // roughly 1/6th are packs
    const createdAt = new Date(now - i * 10 * 60 * 60 * 1000).toISOString(); // spread over ~30 days
    const lastViewedAt = new Date(
      new Date(createdAt).getTime() + 60 * 60 * 1000,
    ).toISOString();
    const baseSlug = `${stack}-${topic}-${String(i + 1).padStart(2, "0")}`;
    const id = `seed-${baseSlug}`.slice(0, 20); // stable, readable ids
    const title = `${stack.toUpperCase()} ${topic} ${
      isPack ? "pack" : "rules"
    }`;
    const description = `Opinionated ${topic} ${
      isPack ? "pack" : "rules"
    } for ${stack} projects. License: ${license}.`;
    const installClickCount = (i * 17) % 500;
    const viewCount = (i * 11) % 300;

    if (isPack) {
      const catalogUrl = `https://aligntrue.ai/a/${id}`;
      const packContent = makePackFiles(title, topic, stack);
      const totalBytes = packContent.files.reduce(
        (sum, file) => sum + (file.size ?? 0),
        0,
      );

      entries.push({
        record: {
          id,
          url: catalogUrl,
          normalizedUrl: catalogUrl,
          provider: "unknown",
          source: "catalog",
          kind: "pack",
          title,
          description,
          author: "AlignTrue",
          fileType: "unknown",
          createdAt,
          lastViewedAt,
          viewCount,
          installClickCount,
          pack: {
            files: packContent.files.map((f) => ({
              path: f.path,
              size: f.size,
            })),
            totalBytes,
          },
          containsAlignIds: [],
        },
        content: packContent,
      });
    } else {
      const fileUrl = `https://github.com/aligntrue/demo/blob/main/rules/${baseSlug}.md`;
      const content = makeRuleContent(title, topic, stack);

      entries.push({
        record: {
          id,
          url: fileUrl,
          normalizedUrl: fileUrl,
          provider: "github",
          kind: "rule",
          title,
          description,
          author: "AlignTrue",
          fileType: "markdown",
          createdAt,
          lastViewedAt,
          viewCount,
          installClickCount,
        },
        content: { kind: "single", content },
      });
    }
  }

  return entries;
}

const seeds = buildSeeds();

export function generateSeedRecords(): AlignRecord[] {
  return seeds.map((entry) => entry.record);
}

export function findSeedContent(id: string): CachedContent | null {
  const entry = seeds.find((seed) => seed.record.id === id);
  return entry ? entry.content : null;
}
