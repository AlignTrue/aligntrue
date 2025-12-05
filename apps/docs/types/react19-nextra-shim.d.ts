/**
 * React 19 / Nextra 4.x type compatibility shim
 *
 * React 19 moved JSX types under React.JSX.*, while some Nextra types
 * still assume the older global JSX namespace. This keeps the docs app
 * compiling until Nextra ships React 19-native types.
 *
 * REMOVE THIS FILE when:
 * - Nextra 5 releases with React 19 as the minimum, OR
 * - nextra-theme-docs exports React 19-compatible component types
 */
import type { ComponentType } from "react";

declare module "nextra-theme-docs" {
  export function useMDXComponents(
    components?: Record<string, ComponentType<unknown>>,
  ): Record<string, ComponentType<unknown>>;
}
