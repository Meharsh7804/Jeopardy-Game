import React from "react";

const FEATURES = [
  "robot",
  "cat",
  "ghost",
  "rocket",
  "wizard",
  "frog",
  "sun",
  "fox",
  "owl",
  "mask",
] as const;

const EXPRESSIONS = ["smile", "grin", "wink", "surprised", "cool"] as const;
const ACCESSORIES = [
  "none",
  "cap",
  "halo",
  "goggles",
  "crown",
  "antenna",
  "scarf",
] as const;
const BACKDROPS = ["dots", "rings", "stripes", "sparkles", "waves"] as const;

type AvatarVariant = (typeof FEATURES)[number];
type Expression = (typeof EXPRESSIONS)[number];
type Accessory = (typeof ACCESSORIES)[number];
type Backdrop = (typeof BACKDROPS)[number];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getVariant = (hash: number): AvatarVariant =>
  FEATURES[hash % FEATURES.length];

const getExpression = (hash: number): Expression =>
  EXPRESSIONS[(hash >> 3) % EXPRESSIONS.length];

const getAccessory = (hash: number): Accessory =>
  ACCESSORIES[(hash >> 5) % ACCESSORIES.length];

const getBackdrop = (hash: number): Backdrop =>
  BACKDROPS[(hash >> 7) % BACKDROPS.length];

const getSeed = (seed: string) => hashString(seed || "player");

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
};

export const getAvatarStyle = (seed: string) => {
  const hash = getSeed(seed);
  const hue = hash % 360;
  const primary = `hsl(${hue} 82% 56%)`;
  const secondary = `hsl(${(hue + 46) % 360} 80% 42%)`;
  const accent = `hsl(${(hue + 178) % 360} 92% 88%)`;
  return {
    variant: getVariant(hash),
    expression: getExpression(hash),
    accessory: getAccessory(hash),
    backdrop: getBackdrop(hash),
    primary,
    secondary,
    accent,
    highlight: `hsl(${(hue + 20) % 360} 100% 74%)`,
    shadow: `hsl(${(hue + 210) % 360} 55% 18%)`,
    rotate: (hash % 18) - 9,
    offset: (hash % 7) - 3,
    flip: (hash & 1) === 0,
  };
};

interface PlayerAvatarProps {
  seed: string;
  name: string;
  size?: number;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  seed,
  name,
  size = 56,
  className = "",
}) => {
  const style = getAvatarStyle(seed);
  const eyeY = 27 + (style.offset > 0 ? 1 : 0);
  const mouthY = 40 + (style.offset < 0 ? -1 : 0);
  const initials = getInitials(name);
  const mainEyeX = style.flip ? 40 : 24;
  const altEyeX = style.flip ? 24 : 40;
  const faceStroke = style.shadow;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${name} avatar`}
      transform={`rotate(${style.rotate} 32 32)`}
    >
      <defs>
        <linearGradient id={`bg-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={style.primary} />
          <stop offset="100%" stopColor={style.secondary} />
        </linearGradient>
        <radialGradient id={`shine-${seed}`} cx="30%" cy="24%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="18"
        fill={`url(#bg-${seed})`}
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="18"
        fill={`url(#shine-${seed})`}
      />
      {style.backdrop === "dots" && (
        <g fill="#ffffff" fillOpacity="0.16">
          <circle cx="14" cy="16" r="1.5" />
          <circle cx="52" cy="18" r="1.5" />
          <circle cx="18" cy="48" r="1.5" />
          <circle cx="48" cy="50" r="1.5" />
        </g>
      )}
      {style.backdrop === "rings" && (
        <g fill="none" stroke="#ffffff" strokeOpacity="0.14">
          <circle cx="18" cy="18" r="6" />
          <circle cx="48" cy="46" r="8" />
        </g>
      )}
      {style.backdrop === "stripes" && (
        <g
          stroke="#ffffff"
          strokeOpacity="0.12"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <path d="M12 52L28 36" />
          <path d="M30 52L46 36" />
          <path d="M20 28L36 12" />
        </g>
      )}
      {style.backdrop === "sparkles" && (
        <g fill="#ffffff" fillOpacity="0.16">
          <path d="M13 25l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
          <path d="M47 15l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" />
        </g>
      )}
      {style.backdrop === "waves" && (
        <path
          d="M8 43C14 39 20 39 26 43C32 47 38 47 44 43C50 39 54 39 56 40"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.15"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {style.variant === "robot" && (
        <>
          <rect
            x="16"
            y="16"
            width="32"
            height="28"
            rx="10"
            fill="#ffffff"
            fillOpacity="0.18"
          />
          <rect
            x="22"
            y="23"
            width="20"
            height="10"
            rx="5"
            fill="#0b1220"
            fillOpacity="0.72"
          />
          <circle cx="25" cy={eyeY} r="2.2" fill="#ffffff" />
          <circle cx="39" cy={eyeY} r="2.2" fill="#ffffff" />
          <rect
            x="28"
            y="40"
            width="8"
            height="4"
            rx="2"
            fill="#0b1220"
            fillOpacity="0.72"
          />
        </>
      )}
      {style.variant === "cat" && (
        <>
          <path d="M18 24L22 14L28 23" fill="#ffffff" fillOpacity="0.18" />
          <path d="M46 24L42 14L36 23" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="32" cy="33" r="13" fill="#ffffff" fillOpacity="0.16" />
        </>
      )}
      {style.variant === "ghost" && (
        <path
          d="M20 24C20 18 25 14 32 14C39 14 44 18 44 24V42C41 40 39 40 36 42C34 43 30 43 28 42C25 40 23 40 20 42V24Z"
          fill="#ffffff"
          fillOpacity="0.2"
        />
      )}
      {style.variant === "rocket" && (
        <path
          d="M32 13C39 18 42 25 42 33L32 50L22 33C22 25 25 18 32 13Z"
          fill="#ffffff"
          fillOpacity="0.18"
        />
      )}
      {style.variant === "wizard" && (
        <>
          <path d="M22 21L32 12L42 21Z" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="32" cy="32" r="12" fill="#ffffff" fillOpacity="0.14" />
        </>
      )}
      {style.variant === "frog" && (
        <>
          <circle cx="24" cy="18" r="5" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="40" cy="18" r="5" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="32" cy="34" r="14" fill="#ffffff" fillOpacity="0.16" />
        </>
      )}
      {style.variant === "sun" && (
        <g>
          <circle cx="32" cy="32" r="13" fill="#ffffff" fillOpacity="0.18" />
          <path
            d="M32 8V16M32 48V56M8 32H16M48 32H56M16 16L21 21M43 43L48 48M16 48L21 43M43 21L48 16"
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {style.variant === "fox" && (
        <path
          d="M17 20L25 16L32 23L39 16L47 20L42 41C39 45 36 48 32 49C28 48 25 45 22 41L17 20Z"
          fill="#ffffff"
          fillOpacity="0.18"
        />
      )}
      {style.variant === "owl" && (
        <>
          <circle cx="24" cy="30" r="8" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="40" cy="30" r="8" fill="#ffffff" fillOpacity="0.18" />
          <path d="M32 26L35 34H29Z" fill="#0b1220" fillOpacity="0.55" />
        </>
      )}
      {style.variant === "mask" && (
        <path
          d="M18 24C22 18 27 16 32 16C37 16 42 18 46 24V36C42 42 37 46 32 46C27 46 22 42 18 36V24Z"
          fill="#ffffff"
          fillOpacity="0.16"
        />
      )}

      {style.accessory === "cap" && (
        <path
          d="M18 25C22 18 26 15 32 15C38 15 42 18 46 25H18Z"
          fill="#ffffff"
          fillOpacity="0.18"
        />
      )}
      {style.accessory === "halo" && (
        <circle
          cx="32"
          cy="13"
          r="10"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.7"
          strokeWidth="2"
        />
      )}
      {style.accessory === "goggles" && (
        <path
          d="M18 28H46M20 28C20 24 23 22 26 22C29 22 32 24 32 28M32 28C32 24 35 22 38 22C41 22 44 24 44 28"
          stroke="#ffffff"
          strokeOpacity="0.75"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {style.accessory === "crown" && (
        <path
          d="M20 22L25 16L32 22L39 16L44 22V26H20Z"
          fill="#ffffff"
          fillOpacity="0.2"
        />
      )}
      {style.accessory === "antenna" && (
        <>
          <path
            d="M26 16L22 10"
            stroke="#ffffff"
            strokeOpacity="0.75"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="21" cy="9" r="2" fill="#ffffff" fillOpacity="0.8" />
          <path
            d="M38 16L42 10"
            stroke="#ffffff"
            strokeOpacity="0.75"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="43" cy="9" r="2" fill="#ffffff" fillOpacity="0.8" />
        </>
      )}
      {style.accessory === "scarf" && (
        <path
          d="M22 42C26 46 38 46 42 42V48H22Z"
          fill="#ffffff"
          fillOpacity="0.2"
        />
      )}

      <path
        d={
          style.expression === "surprised"
            ? `M30 ${mouthY}C31 ${mouthY + 3} 33 ${mouthY + 3} 34 ${mouthY}`
            : style.expression === "wink"
              ? `M26 ${mouthY}C29 ${mouthY + 2} 35 ${mouthY + 2} 38 ${mouthY}`
              : `M26 ${mouthY}C29 ${mouthY + 2} 35 ${mouthY + 2} 38 ${mouthY}`
        }
        stroke={faceStroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {style.expression === "wink" ? (
        <path
          d={`M${mainEyeX - 2} ${eyeY}H${mainEyeX + 2}`}
          stroke={faceStroke}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <circle cx={mainEyeX} cy={eyeY} r="2.5" fill={faceStroke} />
      )}
      <circle cx={altEyeX} cy={eyeY} r="2.5" fill={faceStroke} />
      {style.expression === "surprised" && (
        <circle cx="32" cy={mouthY + 1} r="3.8" fill={faceStroke} />
      )}

      <circle cx="18" cy="18" r="3.2" fill="#ffffff" fillOpacity="0.9" />
      <circle
        cx="47"
        cy="17"
        r="2.4"
        fill={style.highlight}
        fillOpacity="0.9"
      />
      <path
        d="M14 47C20 42 44 42 50 47"
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      <text
        x="50%"
        y="56"
        textAnchor="middle"
        fontSize="8"
        letterSpacing="0.12em"
        fontFamily="ui-rounded, system-ui, sans-serif"
        fontWeight="800"
        fill="#ffffff"
        fillOpacity="0.88"
      >
        {initials}
      </text>
    </svg>
  );
};
