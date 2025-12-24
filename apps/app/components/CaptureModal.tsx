"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CaptureType = "task" | "note";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: CaptureType, data: { title: string; body?: string }) => void;
}

export function CaptureModal({ isOpen, onClose, onSubmit }: Props) {
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setBody("");
      setType("task");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(type, {
        title: title.trim(),
        body: body.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [type, title, body, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/3 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-lg border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={type === "task" ? "default" : "ghost"}
                onClick={() => setType("task")}
              >
                Task
              </Button>
              <Button
                size="sm"
                variant={type === "note" ? "default" : "ghost"}
                onClick={() => setType("note")}
              >
                Note
              </Button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-3 p-4">
            <Input
              placeholder={type === "task" ? "Task title..." : "Note title..."}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && type === "task") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            {type === "note" && (
              <Textarea
                placeholder="Note content (markdown supported)..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              <kbd className="rounded bg-muted px-1">⌘</kbd>+
              <kbd className="rounded bg-muted px-1">Enter</kbd> to save
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
              >
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook for managing capture modal state with keyboard shortcut
export function useCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ⌘K (mac) or Ctrl+K (win/linux) or Ctrl/Cmd + C
      const isModK = e.key === "k" && (e.metaKey || e.ctrlKey);
      const isModC = e.key === "c" && (e.metaKey || e.ctrlKey);
      if (isModK || isModC) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
