import type { ComponentType, ReactNode } from "react";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents } from "../../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export async function generateMetadata(props: {
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

export default async function Page(props: {
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const params = await props.params;
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode,
  } = await importPage(params.mdxPath);
  const { wrapper } = useMDXComponents();
  const Wrapper = wrapper as ComponentType<{
    children: ReactNode;
    toc: unknown;
    metadata: unknown;
    sourceCode: string;
  }>;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
