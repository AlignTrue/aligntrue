/**
 * AlignTrueLogo Component
 *
 * SVG-based logo displaying "align:True" with theme-aware text colors
 * and a fixed orange colon (#F5A623).
 *
 * Usage:
 *   <AlignTrueLogo size="md" />
 *   <AlignTrueLogo size={32} className="custom-class" />
 */

interface AlignTrueLogoProps {
  /**
   * Size of the logo. Accepts preset strings or pixel number.
   * - "sm": 20px height
   * - "md": 28px height
   * - "lg": 36px height
   * - number: custom height in pixels
   */
  size?: "sm" | "md" | "lg" | number;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Whether to render as inline element (default: true)
   */
  inline?: boolean;
}

const sizeMap = {
  sm: 20,
  md: 28,
  lg: 36,
};

export function AlignTrueLogo({
  size = "md",
  className = "",
  inline = true,
}: AlignTrueLogoProps) {
  const height = typeof size === "number" ? size : sizeMap[size];

  // Approximate width based on text ratio (align:True is roughly 4.5:1)
  const width = height * 4.5;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 180 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AlignTrue"
      className={className}
      style={{
        display: inline ? "inline-block" : "block",
        verticalAlign: "middle",
      }}
    >
      <title>AlignTrue</title>

      {/* "align" text - theme-aware color */}
      <text
        x="0"
        y="30"
        fontSize="32"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="currentColor"
        style={{ color: "var(--fgColor-default)" }}
      >
        align
      </text>

      {/* ":" colon - fixed orange */}
      <text
        x="85"
        y="30"
        fontSize="32"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#F5A623"
      >
        :
      </text>

      {/* "True" text - theme-aware color */}
      <text
        x="100"
        y="30"
        fontSize="32"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="currentColor"
        style={{ color: "var(--fgColor-default)" }}
      >
        True
      </text>
    </svg>
  );
}

/**
 * AlignTrueLogoText Component
 *
 * Text-only version for cases where SVG is not suitable.
 * Uses styled spans for the colon color.
 */
interface AlignTrueLogoTextProps {
  className?: string;
}

export function AlignTrueLogoText({ className = "" }: AlignTrueLogoTextProps) {
  return (
    <span
      className={`font-semibold tracking-tight ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--fgColor-default)",
      }}
    >
      align
      <span style={{ color: "#F5A623" }}>:</span>
      True
    </span>
  );
}
