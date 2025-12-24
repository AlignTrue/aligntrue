"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaptureModal, useCaptureModal } from "./CaptureModal";

export function GlobalCapture() {
  const { isOpen, close } = useCaptureModal();
  const router = useRouter();

  const handleSubmit = useCallback(
    async (type: "task" | "note", data: { title: string; body?: string }) => {
      try {
        if (type === "task") {
          // Create task via API
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: data.title,
              bucket: "today",
            }),
          });

          if (!res.ok) {
            // Fallback: redirect to tasks page with title
            router.push(`/tasks?title=${encodeURIComponent(data.title)}`);
          }
        } else {
          // Create note via API
          const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: data.title,
              body_md: data.body ?? "",
            }),
          });

          if (!res.ok) {
            // Fallback: redirect to notes page
            router.push(`/notes?title=${encodeURIComponent(data.title)}`);
          }
        }

        // Refresh the current page to show the new item
        router.refresh();
      } catch {
        // On error, redirect to appropriate page
        if (type === "task") {
          router.push(`/tasks?title=${encodeURIComponent(data.title)}`);
        } else {
          router.push(`/notes?title=${encodeURIComponent(data.title)}`);
        }
      }
    },
    [router],
  );

  return (
    <CaptureModal isOpen={isOpen} onClose={close} onSubmit={handleSubmit} />
  );
}
