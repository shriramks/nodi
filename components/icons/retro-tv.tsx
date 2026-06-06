import type { SVGProps } from "react";

/**
 * Retro TV — outline icon styled to sit alongside lucide icons (24px grid,
 * round caps/joins). Accepts the same props as a lucide icon so it can be
 * dropped into the nav or anywhere a lucide component is expected.
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
      {/* antennas */}
      <path d="M9.7 6.2 8.3 3.2" />
      <path d="M14.3 6.2 15.7 3.2" />
      {/* antenna knobs */}
      <path d="M8.3 2.3 9 3 8.3 3.7 7.6 3Z" />
      <path d="M15.7 2.3 16.4 3 15.7 3.7 15 3Z" />
      {/* body */}
      <rect x="2.5" y="6.2" width="19" height="12" rx="2.5" />
      {/* screen */}
      <rect x="4.8" y="8.4" width="9.7" height="7.6" rx="1.6" />
      {/* dials */}
      <circle cx="18" cy="10.6" r="1.1" />
      <circle cx="18" cy="14" r="1.1" />
      {/* legs */}
      <path d="M8 18.2 6.4 21.2" />
      <path d="M15 18.2 16.6 21.2" />
    </svg>
  );
}
