import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Tabs } from "nextra/components";

type MDXComponents = Record<string, React.ComponentType>;

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    // @ts-expect-error Nextra 4.6.0 component type structure incompatible with React 19
    // This is expected - will be fixed when Nextra 5 releases with React 19 support
    ...getDocsMDXComponents(components),
    Tabs,
  };
}
