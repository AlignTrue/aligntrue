/**
 * Parallel operations support (foundation)
 *
 * Phase 3 Session 10: Performance optimization
 *
 * Provides utilities for parallel source processing with error aggregation.
 */

/**
 * Result of parallel operation
 */
export interface ParallelResult<T> {
  success: T[];
  failures: Array<{ item: any; error: Error }>;
}

/**
 * Process items in parallel with error aggregation
 *
 * Uses Promise.allSettled to process all items even if some fail.
 * Returns successful results and aggregated failures.
 *
 * @param items - Items to process
 * @param processor - Async function to process each item
 * @param options - Processing options
 * @returns Successful results and failures
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { parallel?: boolean; concurrency?: number } = {},
): Promise<ParallelResult<R>> {
  const parallel = options.parallel ?? true;
  const concurrency = options.concurrency ?? items.length;

  if (!parallel || items.length === 0) {
    // Sequential processing
    const success: R[] = [];
    const failures: Array<{ item: T; error: Error }> = [];

    for (const item of items) {
      try {
        const result = await processor(item);
        success.push(result);
      } catch (error) {
        failures.push({
          item,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return { success, failures };
  }

  // Parallel processing with concurrency limit
  const results = await processWithConcurrency(items, processor, concurrency);

  const success: R[] = [];
  const failures: Array<{ item: T; error: Error }> = [];

  results.forEach((result, index) => {
    const item = items[index];
    if (!item) return; // Skip if item doesn't exist (shouldn't happen)

    if (result.status === "fulfilled") {
      success.push(result.value);
    } else {
      failures.push({
        item,
        error:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
      });
    }
  });

  return { success, failures };
}

/**
 * Process items with concurrency limit
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Aggregate errors into single error
 */
export function aggregateErrors(
  failures: Array<{ item: any; error: Error }>,
): Error {
  if (failures.length === 0) {
    return new Error("No errors");
  }

  if (failures.length === 1) {
    return failures[0]!.error;
  }

  const messages = failures.map((f) => `- ${f.error.message}`).join("\n");
  return new Error(`Multiple failures (${failures.length}):\n${messages}`);
}
