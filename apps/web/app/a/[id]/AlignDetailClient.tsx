"use client";

import { PageLayout } from "@/components/PageLayout";
import {
  AlignDetailPreview,
  type AlignDetailPreviewProps,
} from "@/components/AlignDetailPreview";

type Props = AlignDetailPreviewProps;

export function AlignDetailClient({ align, content }: Props) {
  return (
    <PageLayout mainClassName="max-w-6xl mx-auto px-4 py-6 space-y-4 overflow-hidden">
      <AlignDetailPreview align={align} content={content} />
    </PageLayout>
  );
}
