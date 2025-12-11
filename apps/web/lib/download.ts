const mimeByExtension = new Map<string, string>([
  ["md", "text/markdown"],
  ["mdc", "text/markdown"],
  ["txt", "text/plain"],
  ["zip", "application/zip"],
]);

type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};
type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
};

const fileTypes = new Map<string, FilePickerAcceptType>([
  ["md", { description: "Markdown", accept: { "text/markdown": [".md"] } }],
  [
    "mdc",
    { description: "Cursor Rules", accept: { "text/markdown": [".mdc"] } },
  ],
  [
    "zip",
    { description: "ZIP Archive", accept: { "application/zip": [".zip"] } },
  ],
]);

type WindowWithPicker = typeof window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
};

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

function toBlob(content: string | Blob, mime: string): Blob {
  if (content instanceof Blob) {
    return content.type === mime
      ? content
      : content.slice(0, content.size, mime);
  }
  return new Blob([content], { type: mime });
}

function supportsFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as WindowWithPicker).showSaveFilePicker === "function"
  );
}

function buildPickerTypes(ext: string): FilePickerAcceptType[] | undefined {
  const type = fileTypes.get(ext);
  return type ? [type] : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";
}

export async function downloadFile(
  content: string | Blob,
  filename: string,
): Promise<void> {
  const ext = getExtension(filename);
  const mime = mimeByExtension.get(ext) ?? "application/octet-stream";
  const blob = toBlob(content, mime);

  if (supportsFilePicker()) {
    const picker = (window as WindowWithPicker).showSaveFilePicker;
    try {
      const handle = await picker?.({
        suggestedName: filename,
        types: buildPickerTypes(ext),
      });
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (error) {
      if (isAbortError(error)) return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
