import { notFound } from "next/navigation";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import { getCachedContent } from "@/lib/aligns/content-cache";
import { AlignDetailClient } from "./AlignDetailClient";

export const dynamic = "force-dynamic";

const store = getAlignStore();

export default async function AlignDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const align = await store.get(id);
  if (!align) {
    notFound();
  }

  const content = await getCachedContent(align.id, align.normalizedUrl);

  return <AlignDetailClient align={align} content={content} />;
}
