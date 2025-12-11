"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

export function HowItWorksDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  useEffect(() => {
    if (!containerRef.current) return;

    const emeraldPrimary = "#10b981"; // emerald primary
    const lightMuted = "#f1f5f9"; // slate-100
    const darkMuted = "#1e293b"; // slate-800
    const textLight = "#e2e8f0"; // slate-200
    const textDark = "#0f172a"; // slate-900

    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables:
        currentTheme === "dark"
          ? {
              primaryColor: emeraldPrimary,
              primaryTextColor: textLight,
              primaryBorderColor: emeraldPrimary,
              lineColor: "#94a3b8", // slate-400
              secondaryColor: darkMuted,
              tertiaryColor: "#0b1220", // near background dark
              mainBkg: "#0b1220",
              textColor: textLight,
              nodeBorder: emeraldPrimary,
              clusterBkg: darkMuted,
              clusterBorder: "#334155", // slate-700
              edgeLabelBackground: "#0b1220",
            }
          : {
              primaryColor: emeraldPrimary,
              primaryTextColor: textDark,
              primaryBorderColor: emeraldPrimary,
              lineColor: "#94a3b8", // slate-400
              secondaryColor: lightMuted,
              tertiaryColor: "#fff",
              mainBkg: "#fff",
              textColor: textDark,
              nodeBorder: emeraldPrimary,
              clusterBkg: lightMuted,
              clusterBorder: "#cbd5e1", // slate-300
              edgeLabelBackground: "#fff",
            },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
    });

    const diagramDefinition = `
graph TD
    A[Write once, sync to all<br/>agents & team members] --> B[Run <code>aligntrue sync</code>]
    B --> C[Cursor .mdc]
    B --> D[GitHub Copilot]
    B --> E[Claude Code]
    B --> F[VS Code MCP]
    B --> G[20+ other agents]
    B --> H[All team members]
    
    style A fill:${emeraldPrimary},stroke:${emeraldPrimary},color:#fff,stroke-width:2px
    style B fill:${emeraldPrimary},stroke:${emeraldPrimary},color:#fff,stroke-width:2px,font-family:monospace,font-size:15px,font-weight:600
    style C fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
    style D fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
    style E fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
    style F fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
    style G fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
    style H fill:${currentTheme === "dark" ? darkMuted : lightMuted},stroke:#64748b,stroke-width:1px
`;

    const render = async () => {
      try {
        const { svg } = await mermaid.render(
          `mermaid-how-it-works-${Date.now()}`,
          diagramDefinition,
        );
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Failed to render Mermaid diagram:", error);
      }
    };

    render();
  }, [currentTheme]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-center py-8 overflow-auto"
      aria-label="Diagram showing AlignTrue workflow from centralized AI rules to multiple agent outputs and team members"
    />
  );
}
