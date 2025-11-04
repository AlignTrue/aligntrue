import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Tabs } from "nextra/components";

export function useMDXComponents(components?: any): any {
  return {
    ...getDocsMDXComponents(components),
    Tabs,
  };
}
