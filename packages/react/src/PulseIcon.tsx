import React from "react";

export interface PulseIconProps {
  size?: number;
  className?: string;
}

export function PulseIcon({ size = 28, className }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size * (79 / 67)}
      viewBox="0 0 67 79"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="33.5" cy="9.5" r="9.5" fill="url(#pulse-icon-g0)" />
      <path
        d="M33.5 59C14.999 59 0 78.512 0 59c33.5 0 15-35.328 33.5-35.328S33.5 59 67 59c0 19.512-18.499 0-33.5 0z"
        fill="url(#pulse-icon-g1)"
      />
      <defs>
        <linearGradient id="pulse-icon-g0" x1="34" y1="13.5" x2="34" y2="-12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#5A29AD" />
        </linearGradient>
        <linearGradient id="pulse-icon-g1" x1="33.5" y1="23.672" x2="33.5" y2="67.672" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#472187" />
        </linearGradient>
      </defs>
    </svg>
  );
}
