declare module "gray-matter" {
  export type GrayMatterData = Record<string, unknown>;

  export type GrayMatterResult = {
    data: GrayMatterData;
    content: string;
  };

  export default function matter(
    input: string | Buffer,
    options?: unknown,
  ): GrayMatterResult;
}

declare module "js-yaml" {
  export function load(str: string, options?: Record<string, unknown>): unknown;
}
