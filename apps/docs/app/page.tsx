"use client";

import { useEffect } from "react";

export default function HomeRedirectPage() {
  useEffect(() => {
    window.location.replace("/docs");
  }, []);

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <p>Redirecting to /docs…</p>
      <p>
        If you are not redirected,{" "}
        <a href="/docs" style={{ textDecoration: "underline" }}>
          go to /docs
        </a>
        .
      </p>
    </main>
  );
}
