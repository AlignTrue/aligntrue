/**
 * Browser-safe SHA-256 hash using Web Crypto API.
 * Works in browsers and Node.js 15+.
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Synchronous hash for environments where Web Crypto isn't needed.
 * Uses a simple string hash - NOT cryptographically secure.
 * Only for deterministic IDs in client-side rendering.
 */
export function hashSync(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
