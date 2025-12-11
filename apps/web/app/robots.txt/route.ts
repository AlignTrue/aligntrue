const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

export const dynamic = "force-static";

export async function GET() {
  const body = [
    "User-agent: *",
    "Disallow: /_next/",
    "Disallow: /_not-found/",
    "Disallow: /*.txt",
    "Allow: /",
    "",
    `Sitemap: ${BASE_URL}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
