import type { SVGProps } from "react";

/**
 * TV — outline icon styled to sit alongside lucide icons (24px grid, round
 * caps/joins): a rounded screen with crossed antennas and angled legs.
 * Accepts the same props as a lucide icon so it can be dropped into the nav
 * or anywhere a lucide component is expected.
 */
export function RetroTvIcon({
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* crossed antennas */}
      <path d="M8 2.5 13.5 7" />
      <path d="M16 2.5 10.5 7" />
      {/* body */}
      <rect x="2.5" y="6.5" width="19" height="12" rx="3" />
      {/* legs */}
      <path d="M8 18.5 6 21.5" />
      <path d="M16 18.5 18 21.5" />
    </svg>
  );
}
