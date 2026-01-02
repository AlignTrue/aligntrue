import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Tabs, Callout, Cards, Steps } from "nextra/components";
import { Mermaid } from "@theguild/remark-mermaid/mermaid";

type MDXComponents = Record<string, React.ComponentType<unknown>>;

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
