"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/docs");
  }, [router]);

  return (
    <div className="p-6 text-center">
      <p className="text-lg font-medium">Redirecting to documentation…</p>
      <p className="text-sm text-gray-500">
        If you are not redirected, <a href="/docs">continue to docs</a>.
      </p>
    </div>
  );
}
