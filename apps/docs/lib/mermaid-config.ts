/**
 * Mermaid configuration with AlignTrue brand theming
 *
 * Provides consistent diagram styling across light and dark modes
 * with AlignTrue's signature orange accent color (#F5A623).
 */

export const mermaidConfig = {
  theme: "base",
  themeVariables: {
    // Primary colors - AlignTrue orange
    primaryColor: "#F5A623",
    primaryTextColor: "#1a1a1a",
    primaryBorderColor: "#F5A623",

    // Secondary colors
    secondaryColor: "#f5f5f5",
    tertiaryColor: "#fff",

    // Lines and borders
    lineColor: "#666",

    // Text colors
    textColor: "#1a1a1a",
    mainBkg: "#fff",

    // Node styling
    nodeBorder: "#F5A623",
    clusterBkg: "#f5f5f5",
    clusterBorder: "#ddd",

    // Edge styling
    edgeLabelBackground: "#fff",

    // Sequence diagram
    actorBorder: "#F5A623",
    actorBkg: "#f5f5f5",
    actorTextColor: "#1a1a1a",
    actorLineColor: "#666",
    signalColor: "#1a1a1a",
    signalTextColor: "#1a1a1a",
    labelBoxBkgColor: "#f5f5f5",
    labelBoxBorderColor: "#F5A623",
    labelTextColor: "#1a1a1a",
    loopTextColor: "#1a1a1a",
    noteBorderColor: "#F5A623",
    noteBkgColor: "#fff5e6",
    noteTextColor: "#1a1a1a",
    activationBorderColor: "#F5A623",
    activationBkgColor: "#fff5e6",
    sequenceNumberColor: "#fff",
  },
};

export const mermaidConfigDark = {
  theme: "base",
  themeVariables: {
    // Primary colors - AlignTrue orange
    primaryColor: "#F5A623",
    primaryTextColor: "#e5e5e5",
    primaryBorderColor: "#F5A623",

    // Secondary colors
    secondaryColor: "#2a2a2a",
    tertiaryColor: "#1a1a1a",

    // Lines and borders
    lineColor: "#999",

    // Text colors
    textColor: "#e5e5e5",
    mainBkg: "#1a1a1a",

    // Node styling
    nodeBorder: "#F5A623",
    clusterBkg: "#2a2a2a",
    clusterBorder: "#444",

    // Edge styling
    edgeLabelBackground: "#1a1a1a",

    // Sequence diagram
    actorBorder: "#F5A623",
    actorBkg: "#2a2a2a",
    actorTextColor: "#e5e5e5",
    actorLineColor: "#999",
    signalColor: "#e5e5e5",
    signalTextColor: "#e5e5e5",
    labelBoxBkgColor: "#2a2a2a",
    labelBoxBorderColor: "#F5A623",
    labelTextColor: "#e5e5e5",
    loopTextColor: "#e5e5e5",
    noteBorderColor: "#F5A623",
    noteBkgColor: "#332200",
    noteTextColor: "#e5e5e5",
    activationBorderColor: "#F5A623",
    activationBkgColor: "#332200",
    sequenceNumberColor: "#1a1a1a",
  },
};
