import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";

export function useMDXComponents(components?: any): any {
  return getDocsMDXComponents(components);
}
