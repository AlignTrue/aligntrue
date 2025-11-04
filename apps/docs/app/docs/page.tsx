import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents } from "../../mdx-components";

export async function generateMetadata() {
  const { metadata } = await importPage(undefined);
  return metadata;
}

export default async function Page() {
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode,
  } = await importPage(undefined);
  const { wrapper: Wrapper } = useMDXComponents();

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent />
    </Wrapper>
  );
}
