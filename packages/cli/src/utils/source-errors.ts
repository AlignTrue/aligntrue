/**
 * Source error formatting with helpful suggestions
 */

/**
 * Format a source fetch error with helpful context
 */
export function formatSourceFetchError(
  url: string,
  reason: string,
  availableFiles?: string[],
): string {
  let message = `Error: Could not fetch source\n`;
  message += `  URL: ${url}\n`;
  message += `  Reason: ${reason}\n`;

  if (availableFiles && availableFiles.length > 0) {
    message += `\n  Available files in repository:\n`;
    availableFiles.forEach((file) => {
      message += `    - ${file}\n`;
    });

    // Suggest closest match if URL looks like it's trying to target a file
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && !lastPart.includes(".git")) {
      const match = findSimilarFile(lastPart, availableFiles);
      if (match) {
        message += `\n  Did you mean: ${url.replace(lastPart, match)}\n`;
      }
    }
  }

  return message;
}

/**
 * Format a URL parse error
 */
export function formatURLParseError(url: string, reason: string): string {
  let message = `Error: Invalid source URL format\n`;
  message += `  URL: ${url}\n`;
  message += `  Reason: ${reason}\n\n`;
  message += `  Expected format: https://github.com/{org}/{repo}[@{ref}][/{path}]\n`;
  message += `  \n`;
  message += `  Examples:\n`;
  message += `    - https://github.com/company/rules\n`;
  message += `    - https://github.com/company/rules@v2.0.0\n`;
  message += `    - https://github.com/company/rules/packs\n`;
  message += `    - https://github.com/company/rules/packs/security.md\n`;
  return message;
}

/**
 * Format an include validation error
 */
export function formatIncludeValidationError(
  sourceIndex: number,
  reason: string,
): string {
  let message = `Error: Invalid 'include' in source ${sourceIndex}\n`;
  message += `  Reason: ${reason}\n\n`;
  message += `  'include' must be an array of URLs:\n`;
  message += `  Example:\n`;
  message += `  sources:\n`;
  message += `    - type: git\n`;
  message += `      include:\n`;
  message += `        - https://github.com/company/rules\n`;
  message += `        - https://github.com/company/rules@v2.0.0/packs\n`;
  return message;
}

/**
 * Format a ref not found error with available refs
 */
export function formatRefNotFoundError(
  url: string,
  ref: string,
  availableRefs?: string[],
): string {
  let message = `Error: Git reference not found\n`;
  message += `  URL: ${url}\n`;
  message += `  Ref: ${ref}\n`;

  if (availableRefs && availableRefs.length > 0) {
    message += `\n  Available branches/tags:\n`;
    availableRefs.slice(0, 10).forEach((r) => {
      message += `    - ${r}\n`;
    });
    if (availableRefs.length > 10) {
      message += `    ... and ${availableRefs.length - 10} more\n`;
    }
  }

  return message;
}

/**
 * Find a similar filename using simple edit distance
 */
function findSimilarFile(target: string, files: string[]): string | null {
  if (files.length === 0) return null;

  const targetLower = target.toLowerCase();
  const firstFile = files[0];
  if (!firstFile) return null;

  let bestMatch = firstFile;
  let bestScore = editDistance(targetLower, bestMatch.toLowerCase());

  for (const file of files) {
    const score = editDistance(targetLower, file.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      bestMatch = file;
    }
  }

  // Only suggest if score is reasonable (within 40% of target length)
  if (bestScore <= target.length * 0.4) {
    return bestMatch;
  }

  return null;
}

/**
 * Simple edit distance (Levenshtein distance)
 */
function editDistance(a: string, b: string): number {
  const matrix: Array<number[]> = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  const firstRow = matrix[0];
  if (!firstRow) return 0;

  for (let j = 0; j <= a.length; j++) {
    firstRow[j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    const row: number[] = [];
    matrix[i] = row;

    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1];
      if (!prevRow) {
        row[j] = 0;
        continue;
      }

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        const prev = prevRow[j - 1];
        row[j] = prev !== undefined ? prev : 0;
      } else {
        const diag = (prevRow[j - 1] ?? 0) + 1;
        const left = (row[j - 1] ?? 0) + 1;
        const up = (prevRow[j] ?? 0) + 1;
        row[j] = Math.min(diag, left, up);
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow?.[a.length] ?? 0;
}
