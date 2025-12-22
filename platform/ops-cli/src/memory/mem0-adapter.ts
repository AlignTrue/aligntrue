import type {
  IndexResult,
  IndexableItem,
  MemoryProvider,
  MemoryReference,
  QueryContext,
} from "@aligntrue/ops-core";
import { EmbeddingService } from "./embeddings.js";
import { VectorStore } from "./vector-store.js";

interface StoredMetadata {
  entity_type: MemoryReference["entity_type"];
  entity_id: string;
}

/**
 * Local embeddings-backed MemoryProvider.
 * - Stores vectors in-memory (not persisted)
 * - Returns references only (no truth content)
 */
export class Mem0Adapter implements MemoryProvider {
  private readonly store = new VectorStore();
  private readonly embeddings = new EmbeddingService();

  enabled(): boolean {
    return true;
  }

  async index(items: IndexableItem[]): Promise<IndexResult> {
    if (!items.length) return { indexed: 0, skipped: 0 };

    const vectors = await this.embeddings.embed(items.map((i) => i.content));
    let skippedForMissingEmbeddings = 0;
    const vectorItems = items.flatMap((item, idx) => {
      const vector = vectors.at(idx);
      if (!Array.isArray(vector) || vector.length === 0) {
        skippedForMissingEmbeddings += 1;
        return [];
      }

      return [
        {
          id: `${item.entity_type}:${item.entity_id}`,
          vector,
          metadata: {
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            ...(item.metadata ?? {}),
          } satisfies StoredMetadata,
        },
      ];
    });

    const storeResult = this.store.upsertMany(vectorItems);
    return {
      indexed: storeResult.indexed,
      skipped: storeResult.skipped + skippedForMissingEmbeddings,
    };
  }

  async query(context: QueryContext): Promise<MemoryReference[]> {
    // Build a simple query string from context for embedding.
    const queryText = buildQueryText(context);
    const [vector] = await this.embeddings.embed([queryText]);
    if (!vector) return [];

    const results = this.store.search(vector, context.limit ?? 20);
    return results.map((res) => {
      const meta = res.metadata as StoredMetadata | undefined;
      if (meta?.entity_type && meta?.entity_id) {
        return {
          entity_type: meta.entity_type,
          entity_id: meta.entity_id,
          score: res.score,
        };
      }
      // Fallback parse from id
      const [entity_type, entity_id] = res.id.split(":");
      return {
        entity_type: entity_type as MemoryReference["entity_type"],
        entity_id: entity_id ?? "",
        score: res.score,
      };
    });
  }
}

function buildQueryText(context: QueryContext): string {
  const tasks = context.task_ids?.join(" ") ?? "";
  return `week:${context.week_start} tasks:${tasks}`;
}
