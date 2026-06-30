import React from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
}

export function LogoIcon({ className = "", size = 40 }: LogoProps) {
  return (
    <img
      id="siages-logo-image"
      src="/logo-transparent.png?v=3"
      alt="SIAGES Logo"
      width={size}
      height={size}
      className={`select-none shrink-0 object-contain transition-transform hover:scale-105 duration-300 ${className}`}
    />
  );
}
