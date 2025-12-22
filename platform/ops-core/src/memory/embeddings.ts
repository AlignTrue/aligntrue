import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

/**
 * Lightweight wrapper around @xenova/transformers for local embeddings.
 * Caches the model in ~/.cache after first download.
 */
export class EmbeddingService {
  private static pipelinePromise: Promise<FeatureExtractionPipeline> | null =
    null;

  private async getPipeline() {
    if (!EmbeddingService.pipelinePromise) {
      EmbeddingService.pipelinePromise = pipeline("feature-extraction", {
        model: "Xenova/all-MiniLM-L6-v2",
      });
    }
    return EmbeddingService.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const pipe = await this.getPipeline();
    const output = await pipe(texts, { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  }
}
