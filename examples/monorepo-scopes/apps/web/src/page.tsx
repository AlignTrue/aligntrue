// Next.js frontend example file
// This file is in the apps/web scope and gets Next.js-specific rules

"use client";

import Image from "next/image";
import { useState } from "react";

export default function HomePage() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Next.js Frontend</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>

      {/* Good: Using Next.js Image component (nextjs.image-optimization) */}
      <Image src="/logo.png" width={200} height={100} alt="Logo" />
    </div>
  );
}
