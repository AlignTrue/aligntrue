export interface VectorItem {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Simple in-memory vector store with cosine similarity.
 */
export class VectorStore {
  private readonly items = new Map<string, VectorItem>();

  upsertMany(items: VectorItem[]): { indexed: number; skipped: number } {
    let indexed = 0;
    let skipped = 0;
    for (const item of items) {
      if (!item.vector.length) {
        skipped += 1;
        continue;
      }
      this.items.set(item.id, item);
      indexed += 1;
    }
    return { indexed, skipped };
  }

  search(queryVector: number[], limit = 20): SearchResult[] {
    if (!queryVector.length) return [];

    const results: SearchResult[] = [];
    for (const item of this.items.values()) {
      const score = cosineSimilarity(queryVector, item.vector);
      results.push(
        item.metadata !== undefined
          ? { id: item.id, score, metadata: item.metadata }
          : { id: item.id, score },
      );
    }

    return results
      .filter((r) => Number.isFinite(r.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.NEGATIVE_INFINITY;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return Number.NEGATIVE_INFINITY;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
