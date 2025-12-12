"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

let mermaidInitialized = false;

function ensureMermaidInitialized() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: "basis",
    },
  });
  mermaidInitialized = true;
}

export function HowItWorksDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCounterRef = useRef(0);
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  useEffect(() => {
    if (!containerRef.current) return;

    ensureMermaidInitialized();

    // Primary colors: brighter in light mode, muted in dark mode
    const emeraldLight = "#10b981"; // emerald-500 for light mode
    const emeraldDark = "#047857"; // emerald-700 for dark mode (more muted)
    const primaryColor = currentTheme === "dark" ? emeraldDark : emeraldLight;
    const primaryText = "#ffffff"; // white text on primary nodes
    const lightMuted = "#f1f5f9"; // slate-100
    const darkMuted = "#0f172a"; // slate-900 for stronger contrast in dark mode
    const darkStroke = "#cbd5e1"; // slate-300 for border contrast

    const renderId = `mermaid-how-it-works-${currentTheme}-${++renderCounterRef.current}`;

    const diagramDefinition = `
graph TD
    A[Write once, sync to all<br/>agents & team members] --> B[Run <code>aligntrue sync</code>]
    B --> C[Cursor .mdc]
    B --> D[GitHub Copilot]
    B --> E[Claude Code]
    B --> F[VS Code MCP]
    B --> G[20+ other agents]
    B --> H[All team members]
    
    style A fill:${primaryColor},stroke:${primaryColor},color:${primaryText},stroke-width:2px
    style B fill:${primaryColor},stroke:${primaryColor},color:${primaryText},stroke-width:2px,font-family:monospace,font-size:15px,font-weight:600
    style C fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
    style D fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
    style E fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
    style F fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
    style G fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
    style H fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:${currentTheme === "dark" ? darkStroke : "#64748b"},stroke-width:1px,color:${currentTheme === "dark" ? "#e2e8f0" : "#0f172a"}
`;

    const render = async () => {
      try {
        const { svg } = await mermaid.render(renderId, diagramDefinition);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          const nodeLabels =
            containerRef.current.querySelectorAll<HTMLElement>(".nodeLabel p");
          nodeLabels.forEach((el) => {
            if (!el.style.color) {
              el.style.color = currentTheme === "dark" ? "#e2e8f0" : "#0f172a";
            }
          });
        }
      } catch (error) {
        console.error("Failed to render Mermaid diagram:", error);
      }
    };

    void render();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [currentTheme]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-center py-8 overflow-auto"
      aria-label="Diagram showing AlignTrue workflow from centralized AI rules to multiple agent outputs and team members"
    />
  );
}
