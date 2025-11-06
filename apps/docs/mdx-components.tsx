import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Tabs } from "nextra/components";

type MDXComponents = Record<string, React.ComponentType>;

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...getDocsMDXComponents(components),
    Tabs,
  };
}
