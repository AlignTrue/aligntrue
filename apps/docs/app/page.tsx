"use client";

import { useEffect } from "react";

const REDIRECT_PATH = "/docs";

export default function HomeRedirectPage() {
  useEffect(() => {
    window.location.replace(REDIRECT_PATH);
  }, []);

  return (
    <div className="p-6 text-center">
      <p className="text-lg font-medium">Redirecting to documentation…</p>
      <p className="text-sm text-gray-500">
        If you are not redirected, <a href={REDIRECT_PATH}>continue to docs</a>.
      </p>
    </div>
  );
}
