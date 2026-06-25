import React from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
}

export function LogoIcon({ className = "", size = 40 }: LogoProps) {
  return (
    <svg
      id="siages-vector-logo"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 transition-transform hover:scale-105 duration-300 ${className}`}
    >
      {/* 
        PREMIUM DUAL-RIBBON INTERLOCKING HEXAGONAL LOGO
        Upper/Left Ribbon: Vibrant Blue (#2A4FDA)
        Lower/Right Ribbon: Vibrant Logo Green (#6BC01B)
        Center Bars: Strategic blue analytics charts
      */}
      
      {/* Blue Upper Ribbon */}
      <path
        d="M 50,8
           L 12,30
           L 12,54
           L 26,46
           L 26,38
           L 50,24
           L 74,38
           L 74,44
           L 88,36
           L 88,30
           Z"
        fill="#2A4FDA"
        className="fill-[#2A4FDA]"
      />

      {/* Green Lower Ribbon */}
      <path
        d="M 50,92
           L 88,70
           L 88,46
           L 74,54
           L 74,62
           L 50,76
           L 26,62
           L 26,56
           L 12,64
           L 12,70
           Z"
        fill="#6BC01B"
        className="fill-[#6BC01B]"
      />

      {/* Center Analytics Bars (Blue) */}
      <rect
        x="37"
        y="47"
        width="6"
        height="15"
        rx="1.5"
        fill="#2A4FDA"
        className="fill-[#2A4FDA]"
      />
      
      <rect
        x="47"
        y="36"
        width="6"
        height="26"
        rx="1.5"
        fill="#2A4FDA"
        className="fill-[#2A4FDA]"
      />
      
      <rect
        x="57"
        y="44"
        width="6"
        height="18"
        rx="1.5"
        fill="#2A4FDA"
        className="fill-[#2A4FDA]"
      />
    </svg>
  );
}
