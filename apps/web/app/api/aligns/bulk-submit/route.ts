import { NextResponse } from "next/server";

import { addRuleToPack } from "@/lib/aligns/relationships";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import { alignIdFromNormalizedUrl } from "@/lib/aligns/normalize";
import { rateLimit, hashString } from "@/lib/aligns/submit-helpers";
import {
  BULK_IMPORT_MAX_URLS,
  DESCRIPTION_MAX_CHARS,
} from "@/lib/aligns/constants";
import { validateAlignUrl } from "@/lib/aligns/url-validation";
import { buildCatalogPackRecord } from "@/lib/aligns/records";
import type { AlignRecord } from "@/lib/aligns/types";
import { POST as submitSingle } from "../submit/route";

export const dynamic = "force-dynamic";

const store = getAlignStore();

type BulkResult =
  | { url: string; status: "success"; id: string; title?: string | null }
  | { url: string; status: "exists"; id: string; title?: string | null }
  | { url: string; status: "error"; error: string };

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ error: "Missing urls" }, { status: 400 });
  }

  const urls: string[] = body.urls.slice(0, BULK_IMPORT_MAX_URLS);
  const results: BulkResult[] = [];
  const successIds: { id: string; url: string; title?: string | null }[] = [];

  for (const url of urls) {
    const validation = validateAlignUrl(url);
    if (!validation.valid) {
      results.push({
        url,
        status: "error",
        error: validation.error ?? "Invalid URL",
      });
      continue;
    }

    // Process sequentially to avoid rate spikes
    const singleReq = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ url }),
    });

    try {
      const res = await submitSingle(singleReq);
      const data = await res.json();
      if (res.ok && data?.id) {
        results.push({
          url,
          status: "success",
          id: data.id,
          title: data.title,
        });
        successIds.push({ id: data.id, url, title: data.title });
      } else {
        results.push({
          url,
          status: "error",
          error: data?.error ?? "Failed to import URL",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import URL";
      results.push({ url, status: "error", error: message });
    }
  }

  let pack: { id: string; url: string; title?: string } | undefined;
  const createPack = body.createPack;
  if (createPack && successIds.length > 0) {
    const { title, description, author } = createPack as {
      title?: string;
      description?: string;
      author?: string | null;
    };

    if (!title || !description) {
      return NextResponse.json(
        { error: "Pack title and description are required" },
        { status: 400 },
      );
    }
    if (description.length > DESCRIPTION_MAX_CHARS) {
      return NextResponse.json(
        { error: `Description must be <= ${DESCRIPTION_MAX_CHARS} characters` },
        { status: 400 },
      );
    }

    const hashInput = `${title}:${successIds.map((s) => s.id).join("|")}`;
    const syntheticUrl = `https://aligntrue.ai/catalog/${hashString(hashInput)}`;
    const id = alignIdFromNormalizedUrl(syntheticUrl);
    const now = new Date().toISOString();
    const existing: AlignRecord | null = await store.get(id);
    const packRecord = buildCatalogPackRecord({
      id,
      title,
      description,
      author: author ?? null,
      ruleIds: successIds.map((s) => s.id),
      now,
      existing,
    });
    await store.upsert(packRecord);
    await Promise.all(successIds.map((s) => addRuleToPack(s.id, id)));
    pack = { id, url: `/a/${id}`, title };
  }

  return NextResponse.json({ results, pack });
}
