import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Tabs, Callout, Cards, Steps } from "nextra/components";
import { Mermaid } from "@theguild/remark-mermaid/mermaid";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MDXComponents = Record<string, React.ComponentType<any>>;

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...getDocsMDXComponents(components),
    Tabs,
    Callout,
    Cards,
    Steps,
    Mermaid,
  };
}
