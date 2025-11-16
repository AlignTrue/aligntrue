import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ExporterRegistry } from "@aligntrue/exporters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FALLBACK_PATHS = [
  resolve(__dirname, "../../../../packages/exporters/dist"),
  resolve(__dirname, "../../../../exporters/dist"),
];

export interface ExporterValidationIssue {
  name: string;
  suggestion?: string;
}

/**
 * Determine which configured exporters are invalid.
 *
 * @param exporterNames - Exporters configured in .aligntrue/config.yaml
 * @returns Array of invalid exporters with optional suggestions
 */
export async function getInvalidExporters(
  exporterNames: string[] | undefined,
): Promise<ExporterValidationIssue[]> {
  if (!exporterNames || exporterNames.length === 0) {
    return [];
  }

  const available = await loadAvailableExporterNames();
  const availableList = Array.from(available).sort();
  const invalid: ExporterValidationIssue[] = [];

  for (const name of exporterNames) {
    if (!available.has(name)) {
      const suggestion = findClosestExporter(name, availableList);
      const entry: ExporterValidationIssue = { name };
      if (suggestion) {
        entry.suggestion = suggestion;
      }
      invalid.push(entry);
    }
  }

  return invalid;
}

async function loadAvailableExporterNames(): Promise<Set<string>> {
  const registry = new ExporterRegistry();
  const manifestPaths = await discoverExporterManifests(registry);
  const available = new Set<string>();

  for (const manifestPath of manifestPaths) {
    try {
      const manifest = registry.loadManifest(manifestPath);
      if (manifest?.name) {
        available.add(manifest.name);
      }
    } catch {
      // Ignore invalid manifests
      continue;
    }
  }

  if (available.size === 0) {
    throw new Error(
      "No exporters available. Reinstall AlignTrue or run 'pnpm build' to regenerate exporters.",
    );
  }

  return available;
}

async function discoverExporterManifests(
  registry: ExporterRegistry,
): Promise<string[]> {
  const searchPaths: string[] = [];

  try {
    const exportersPackagePath = await import.meta.resolve(
      "@aligntrue/exporters",
    );
    const exportersIndexPath = fileURLToPath(exportersPackagePath);
    searchPaths.push(dirname(exportersIndexPath));
  } catch {
    // ignore - fallbacks below
  }

  for (const fallback of FALLBACK_PATHS) {
    if (!searchPaths.includes(fallback)) {
      searchPaths.push(fallback);
    }
  }

  let lastError: unknown;
  for (const path of searchPaths) {
    try {
      return registry.discoverAdapters(path);
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw lastError ?? new Error("Unable to discover exporter manifests");
}

function findClosestExporter(
  target: string,
  candidates: string[],
): string | undefined {
  let bestMatch: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  const threshold = Math.max(2, Math.floor(target.length / 2));
  return bestDistance <= threshold ? bestMatch : undefined;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const rows = b.length + 1;
  const cols = a.length + 1;

  const matrix: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(0),
  );

  for (let i = 0; i < rows; i++) {
    const row = matrix[i];
    if (!row) {
      continue;
    }
    row[0] = i;
  }

  const firstRow = matrix[0];
  if (firstRow) {
    for (let j = 0; j < cols; j++) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i < rows; i++) {
    const currentRow = matrix[i];
    const previousRow = matrix[i - 1];

    if (!currentRow || !previousRow) {
      continue;
    }

    for (let j = 1; j < cols; j++) {
      const diagonal = previousRow[j - 1] ?? 0;
      const up = previousRow[j] ?? 0;
      const left = currentRow[j - 1] ?? 0;
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currentRow[j] = diagonal;
      } else {
        currentRow[j] = Math.min(up + 1, left + 1, diagonal + 1);
      }
    }
  }

  const lastRow = matrix[rows - 1];
  if (!lastRow) {
    return cols - 1;
  }
  return lastRow[cols - 1] ?? cols - 1;
}
