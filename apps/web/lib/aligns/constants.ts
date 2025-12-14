export const ALLOWED_EXTENSIONS = [
  ".md",
  ".mdc",
  ".mdx",
  ".markdown",
  ".yaml",
  ".yml",
  ".xml",
] as const;

export const ALLOWED_FILENAMES = [
  ".clinerules",
  ".cursorrules",
  ".goosehints",
] as const;

export const MAX_FILE_BYTES = 500 * 1024;
export const RATE_LIMIT_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const BULK_IMPORT_MAX_URLS = 50;
export const DESCRIPTION_MAX_CHARS = 280;
export const TITLE_MAX_CHARS = 60;
