import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  /** Render the "Buzzing With Quizzing" wordmark next to the badge. */
  withWordmark?: boolean;
}

/**
 * Game-show "buzz button" logo: a gradient tile, an electric bolt, and the red
 * buzzer dot. Reused across the lobby header, host header and (via the favicon
 * SVG) browser tab / PWA icon so the brand is consistent everywhere.
 */
export const Logo: React.FC<LogoProps> = ({ size = 40, className = "", withWordmark = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 256 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_14px_rgba(99,102,241,0.5)] shrink-0"
        aria-hidden
      >
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="logo-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="256" height="256" rx="60" fill="url(#logo-bg)" />
        <rect
          x="14"
          y="14"
          width="228"
          height="228"
          rx="48"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="5"
        />
        <rect width="256" height="256" rx="60" fill="url(#logo-sheen)" />
        <g transform="translate(26 28) scale(8.5)">
          <path
            d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </g>
        <circle cx="204" cy="206" r="17" fill="#f43f5e" stroke="#ffffff" strokeWidth="6" />
      </svg>
      {withWordmark && (
        <span className="font-display font-extrabold text-xs tracking-[0.2em] uppercase leading-tight">
          <span className="text-white">Buzzing</span>{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-accent to-secondary-accent">
            With
          </span>{" "}
          <span className="text-white">Quizzing</span>
        </span>
      )}
    </div>
  );
};