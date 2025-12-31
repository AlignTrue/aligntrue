export { cn, formatBytes, isAbortError } from "@aligntrue/ui";

/**
 * Get the base URL for the application, considering environment variables.
 */
export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.startsWith("http")
      ? process.env.APP_BASE_URL
      : `https://${process.env.APP_BASE_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3100";
}
