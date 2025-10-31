/**
 * Generate search_v1.json from catalog index.json
 * Extracts minimal fields needed for client-side search
 */
import fs from "fs/promises";
import path from "path";

async function generateSearchIndex() {
  const catalogPath = path.join(process.cwd(), "public/catalog/index.json");
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf-8"));

  const searchIndex = {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    entries: catalog.packs.map((pack: any) => ({
      id: pack.id,
      name: pack.name,
      slug: pack.slug,
      description: pack.description,
      summary_bullets: pack.summary_bullets || [],
      categories: pack.categories,
      tags: pack.tags || [],
      compatible_tools: pack.compatible_tools,
      license: pack.license,
      last_updated: pack.last_updated,
      has_plugs: pack.has_plugs,
      overlay_friendly: pack.overlay_friendly,
      stats: {
        copies_7d: pack.stats.copies_7d,
      },
    })),
  };

  const outputPath = path.join(process.cwd(), "public/catalog/search_v1.json");
  await fs.writeFile(outputPath, JSON.stringify(searchIndex, null, 2));
  console.log(`Generated ${outputPath}`);
}

generateSearchIndex().catch(console.error);
