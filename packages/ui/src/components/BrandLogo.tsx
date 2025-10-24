/**
 * BrandLogo Component
 * 
 * Simple text-based placeholder logo for Phase 1.
 * Can be swapped for SVG when brand assets are ready.
 */

interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span
      className={`font-semibold text-xl tracking-tight ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--color-neutral-900)"
      }}
    >
      AlignTrue
    </span>
  )
}

