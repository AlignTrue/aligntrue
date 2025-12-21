"use client";

import { useMemo, useRef, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  noteId: string;
  body: string;
}

export function NotePreview({ noteId, body }: Props) {
  const [pending, startTransition] = useTransition();

  const checkboxLines = useMemo(() => {
    const lines = body.split("\n");
    const indexes: number[] = [];
    lines.forEach((line, idx) => {
      if (/^\s*-\s*\[( |x|X)\]/.test(line)) {
        indexes.push(idx);
      }
    });
    return indexes;
  }, [body]);

  const checkboxCursor = useRef(0);

  // Reset cursor at the start of each render so indices stay aligned in Strict Mode
  checkboxCursor.current = 0;

  const toggle = (lineIndex: number) => {
    if (lineIndex < 0) return;
    startTransition(async () => {
      await fetch("/api/notes/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId, line_index: lineIndex }),
      });
    });
  };

  return (
    <div className="prose max-w-none rounded-lg border bg-card p-4 text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          input: ({ node: _node, ...props }) => {
            if (props.type === "checkbox") {
              const lineIndex = checkboxLines[checkboxCursor.current] ?? -1;
              checkboxCursor.current += 1;
              return (
                <input
                  {...props}
                  type="checkbox"
                  onChange={() => toggle(lineIndex)}
                  disabled={pending}
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
