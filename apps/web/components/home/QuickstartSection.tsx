/**
 * Quickstart section for homepage (Phase 4, Session 6)
 *
 * "Try in 30 seconds" hero section with featured pack and copy-first flow.
 */

"use client";

import { useState } from "react";
import Link from "next/link";

export function QuickstartSection() {
  const [copied, setCopied] = useState(false);

  // Installation command
  const installScript = `curl -fsSL https://aligntrue.ai/install.sh | bash`;
  const addCommand = `aligntrue add aligntrue/aligns:packs/base/base-global --from=catalog_web`;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <section className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        {/* Hero heading */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Try AlignTrue in 30 seconds
          </h1>
          <p className="text-xl text-neutral-300">
            Get started with AI-native rules and alignment for your code agents
          </p>
        </div>

        {/* Two-step quickstart */}
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Step 1: Install CLI */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-neutral-700 text-sm font-bold mr-3">
                  1
                </span>
                <span className="text-lg font-semibold">Install the CLI</span>
              </div>
            </div>
            <div className="ml-11">
              <div className="bg-neutral-900 rounded-md p-4 font-mono text-sm overflow-x-auto mb-3">
                <code>{installScript}</code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(installScript)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy command
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Add a pack */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-neutral-700 text-sm font-bold mr-3">
                  2
                </span>
                <span className="text-lg font-semibold">
                  Add your first pack (base-global)
                </span>
              </div>
            </div>
            <div className="ml-11">
              <div className="bg-neutral-900 rounded-md p-4 font-mono text-sm overflow-x-auto mb-3">
                <code>{addCommand}</code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(addCommand)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy command
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-lg text-lg font-semibold hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            Browse all packs
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold mb-2">43+</div>
            <div className="text-neutral-300">Exporter formats</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">28+</div>
            <div className="text-neutral-300">AI coding agents</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">100%</div>
            <div className="text-neutral-300">Deterministic</div>
          </div>
        </div>
      </div>
    </section>
  );
}
