import React from "react";

interface AegisBrandIconProps {
  className?: string;
}

export const AegisBrandIcon: React.FC<AegisBrandIconProps> = ({
  className = "w-8 h-8 shrink-0",
}) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <defs>
      <linearGradient id="aegis-brand-bg" x1="48" y1="36" x2="464" y2="476" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f8fcff" />
        <stop offset="55%" stopColor="#e4f1fc" />
        <stop offset="100%" stopColor="#cbe4fa" />
      </linearGradient>
      <linearGradient id="aegis-brand-orbit" x1="110" y1="380" x2="402" y2="132" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0f294d" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="aegis-brand-ring" x1="160" y1="180" x2="352" y2="390" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>

    <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#aegis-brand-bg)" />
    <rect x="20" y="20" width="472" height="472" rx="112" stroke="#bae6fd" strokeWidth="12" />

    <path
      d="M 134 256 A 122 122 0 1 1 374 226"
      stroke="#0c234b"
      strokeWidth="24"
      strokeLinecap="round"
    />

    <circle
      cx="256"
      cy="282"
      r="86"
      stroke="url(#aegis-brand-ring)"
      strokeWidth="20"
    />

    <path
      d="M 118 352 C 92 316, 152 246, 240 190 C 328 134, 394 114, 412 142 C 426 164, 384 222, 314 274"
      stroke="url(#aegis-brand-orbit)"
      strokeWidth="20"
      strokeLinecap="round"
    />

    <path
      d="M 106 268 H 188 L 210 232 L 236 322 L 260 198 L 286 306 L 308 250 L 326 268 H 406"
      stroke="#e8f3fc"
      strokeWidth="34"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M 112 268 H 188 L 210 232 L 236 322 L 260 198 L 286 306 L 308 250 L 326 268 H 400"
      stroke="#0c234b"
      strokeWidth="18"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <circle cx="388" cy="146" r="16" fill="#0ea5e9" stroke="#f8fcff" strokeWidth="6" />
  </svg>
);
