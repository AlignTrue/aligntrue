import { getAlignStore, hasKvEnv } from "@/lib/aligns/storeFactory";
import {
  buildDescription,
  buildInstallCommand,
  buildOgImageResponse,
  generateOgImage,
} from "@/lib/og/generate";
import { getOgMetadata, putOgImage } from "@/lib/og/storage";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

const store = getAlignStore();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const canUseBlob = hasKvEnv() && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const existingMeta = canUseBlob ? await getOgMetadata(id) : null;
    if (canUseBlob && existingMeta?.url) {
      try {
        const check = await fetch(existingMeta.url, { method: "HEAD" });
        if (check.ok) {
          return Response.redirect(existingMeta.url, 302);
        }
        console.warn(`[og] cached blob missing for ${id}, regenerating`);
      } catch (error) {
        console.warn("[og] blob HEAD check failed, regenerating", error);
      }
    }

    const align = await store.get(id);

    if (!align) {
      return new Response("Not found", { status: 404 });
    }

    if (!canUseBlob) {
      return await buildOgImageResponse({
        align,
        id,
        headers: {
          "Cache-Control": "public, max-age=3600, must-revalidate",
        },
      });
    }

    const jpegBuffer = await generateOgImage({ align, id });
    const upload = await putOgImage({
      buffer: jpegBuffer,
      alignId: id,
      alignContentHash: align.contentHash,
    });

    // Response expects a typed array/ArrayBuffer in this runtime, not Node Buffer.
    const body = new Uint8Array(jpegBuffer);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // Shorter cache to avoid stale OG data after align updates; Blob URL is immutable.
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "X-OG-Canonical": upload.url,
      },
    });
  } catch (error) {
    console.error(`[og] generation failed for ${id}:`, error);
    return Response.redirect(`${BASE_URL}/aligntrue-og-image.png`, 302);
  }
}

export { buildDescription, buildInstallCommand };
