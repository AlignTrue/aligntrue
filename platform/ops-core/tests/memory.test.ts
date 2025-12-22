import { beforeEach, describe, expect, it, vi } from "vitest";
import { Mem0Adapter } from "../src/memory/mem0-adapter.js";
import { EmbeddingService } from "../src/memory/embeddings.js";

describe("mem0 adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("indexes and queries references", async () => {
    const embedMock = vi
      .spyOn(EmbeddingService.prototype, "embed")
      // First call: index vectors; Second call: query vector
      .mockResolvedValueOnce([
        [1, 0],
        [0, 1],
      ])
      .mockResolvedValueOnce([[0.9, 0.1]]);

    const adapter = new Mem0Adapter();

    const indexResult = await adapter.index([
      { entity_type: "task", entity_id: "t1", content: "task one" },
      { entity_type: "note", entity_id: "n1", content: "note one" },
    ]);

    expect(indexResult.indexed).toBe(2);

    const results = await adapter.query({
      week_start: "2024-01-01",
      task_ids: [],
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entity_id).toBe("t1");
    expect(embedMock).toHaveBeenCalled();
  });

  it("counts skipped items when embeddings are missing", async () => {
    vi.spyOn(EmbeddingService.prototype, "embed").mockResolvedValue([
      [],
      [1, 0],
    ]);

    const adapter = new Mem0Adapter();
    const result = await adapter.index([
      { entity_type: "task", entity_id: "t1", content: "task one" },
      { entity_type: "task", entity_id: "t2", content: "task two" },
    ]);

    expect(result.indexed).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("handles empty input gracefully", async () => {
    const adapter = new Mem0Adapter();
    const indexResult = await adapter.index([]);
    expect(indexResult.indexed).toBe(0);

    const results = await adapter.query({
      week_start: "2024-01-01",
      task_ids: [],
    });
    expect(results).toEqual([]);
  });
});
