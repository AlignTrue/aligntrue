import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

/**
 * Lightweight wrapper around @huggingface/transformers for local embeddings.
 * Caches the model in ~/.cache after first download.
 */
export class EmbeddingService {
  private static pipelinePromise: Promise<FeatureExtractionPipeline> | null =
    null;

  private async getPipeline() {
    if (!EmbeddingService.pipelinePromise) {
      const pipe = (await (
        pipeline as unknown as (task: string, model: string) => Promise<unknown>
      )(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      )) as FeatureExtractionPipeline;
      EmbeddingService.pipelinePromise = Promise.resolve(pipe);
    }
    return EmbeddingService.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const pipe = await this.getPipeline();
    const output = (await pipe(texts, {
      pooling: "mean",
      normalize: true,
    })) as { tolist(): number[][] };
    return output.tolist();
  }
}
