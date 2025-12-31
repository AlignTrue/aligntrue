import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function NotePreview({
  noteId: _noteId,
  body,
}: {
  noteId: string;
  body: string;
}) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none border rounded p-3 bg-muted/30">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
