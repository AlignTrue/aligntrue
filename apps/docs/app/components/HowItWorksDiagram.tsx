"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

/**
 * HowItWorksDiagram Component
 *
 * Renders a Mermaid diagram showing the AlignTrue workflow:
 * AGENTS.md → aligntrue sync → Multiple agent outputs
 *
 * Dynamically updates based on light/dark theme.
 */
export function HowItWorksDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  useEffect(() => {
    if (!containerRef.current) return;

    // Configure Mermaid with AlignTrue branding
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables:
        currentTheme === "dark"
          ? {
              // Dark mode - AlignTrue orange
              primaryColor: "#F5A623",
              primaryTextColor: "#e5e5e5",
              primaryBorderColor: "#F5A623",
              lineColor: "#999",
              secondaryColor: "#2a2a2a",
              tertiaryColor: "#1a1a1a",
              mainBkg: "#1a1a1a",
              textColor: "#e5e5e5",
              nodeBorder: "#F5A623",
              clusterBkg: "#2a2a2a",
              clusterBorder: "#444",
              edgeLabelBackground: "#1a1a1a",
            }
          : {
              // Light mode - AlignTrue orange
              primaryColor: "#F5A623",
              primaryTextColor: "#1a1a1a",
              primaryBorderColor: "#F5A623",
              lineColor: "#666",
              secondaryColor: "#f5f5f5",
              tertiaryColor: "#fff",
              mainBkg: "#fff",
              textColor: "#1a1a1a",
              nodeBorder: "#F5A623",
              clusterBkg: "#f5f5f5",
              clusterBorder: "#ddd",
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
    A[Write in any format<br/>AGENTS, CLAUDE, etc.] --> B[run <code>aligntrue sync</code>]
    B --> C[Cursor .mdc]
    B --> D[GitHub Copilot]
    B --> E[Claude Code]
    B --> F[VS Code MCP]
    B --> G[28+ other agents]
    
    style A fill:#F5A623,stroke:#F5A623,color:#fff,stroke-width:2px
    style B fill:#F5A623,stroke:#F5A623,color:#fff,stroke-width:2px,font-family:monospace,font-size:15px,font-weight:600
    style C fill:${currentTheme === "dark" ? "#2a2a2a" : "#f5f5f5"},stroke:#666,stroke-width:1px
    style D fill:${currentTheme === "dark" ? "#2a2a2a" : "#f5f5f5"},stroke:#666,stroke-width:1px
    style E fill:${currentTheme === "dark" ? "#2a2a2a" : "#f5f5f5"},stroke:#666,stroke-width:1px
    style F fill:${currentTheme === "dark" ? "#2a2a2a" : "#f5f5f5"},stroke:#666,stroke-width:1px
    style G fill:${currentTheme === "dark" ? "#2a2a2a" : "#f5f5f5"},stroke:#666,stroke-width:1px
`;

    // Render the diagram
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
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem 0",
        overflow: "auto",
      }}
      aria-label="Diagram showing AlignTrue workflow from AGENTS.md to multiple agent outputs"
    />
  );
}
