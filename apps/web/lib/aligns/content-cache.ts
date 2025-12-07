import { kv } from "@vercel/kv";
import { githubBlobToRawUrl } from "./normalize";

const CONTENT_TTL_SECONDS = 3600; // 1 hour
const MAX_BYTES = 256 * 1024;

async function fetchWithLimit(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;

  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function getCachedContent(
  id: string,
  normalizedUrl: string,
): Promise<string | null> {
  const cacheKey = `v1:align:content:${id}`;
  const cached = await kv.get<string>(cacheKey);
  if (cached) return cached;

  const rawUrl = githubBlobToRawUrl(normalizedUrl);
  if (!rawUrl) return null;

  const content = await fetchWithLimit(rawUrl);
  if (!content) return null;

  await kv.set(cacheKey, content, { ex: CONTENT_TTL_SECONDS });
  return content;
}
