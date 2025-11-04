/**
 * Install button component (Phase 4, Session 5)
 *
 * Primary CTA button that opens installation modal.
 * Prominent placement on pack detail page.
 */

"use client";

export interface InstallButtonProps {
  /** Click handler to open modal */
  onClick: () => void;
  /** Optional button text override */
  label?: string;
  /** Optional size variant */
  size?: "default" | "large";
}

/**
 * Install button component
 */
export function InstallButton({
  onClick,
  label = "Install with AlignTrue",
  size = "default",
}: InstallButtonProps) {
  const sizeClasses = {
    default: "px-5 py-2.5 text-base",
    large: "px-6 py-3 text-lg",
  };

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClasses[size]}
        bg-neutral-900 text-white rounded-lg
        hover:bg-neutral-800 active:bg-neutral-950
        transition-colors font-medium
        inline-flex items-center gap-2
        shadow-sm hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2
      `}
      aria-label="Install this pack"
    >
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
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
