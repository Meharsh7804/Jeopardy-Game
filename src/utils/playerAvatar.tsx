import React from 'react';

const COLORS = [
  ['#4f7cff', '#1f3fa6', '#dbe6ff'],
  ['#10b981', '#0f766e', '#d1fae5'],
  ['#f59e0b', '#b45309', '#fef3c7'],
  ['#ef4444', '#991b1b', '#fee2e2'],
  ['#8b5cf6', '#6d28d9', '#ede9fe'],
  ['#06b6d4', '#0e7490', '#cffafe'],
  ['#ec4899', '#be185d', '#fce7f3'],
  ['#22c55e', '#166534', '#dcfce7'],
];

const FEATURES = ['blob', 'orbit', 'stack', 'badge', 'spark', 'helmet'] as const;

type AvatarVariant = typeof FEATURES[number];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getVariant = (hash: number): AvatarVariant => FEATURES[hash % FEATURES.length];

const getSeed = (seed: string) => hashString(seed || 'player');

export const getAvatarStyle = (seed: string) => {
  const hash = getSeed(seed);
  const [primary, secondary, accent] = COLORS[hash % COLORS.length];
  return {
    variant: getVariant(hash),
    primary,
    secondary,
    accent,
    rotate: (hash % 18) - 9,
    offset: (hash % 7) - 3,
  };
};

interface PlayerAvatarProps {
  seed: string;
  name: string;
  size?: number;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ seed, name, size = 56, className = '' }) => {
  const style = getAvatarStyle(seed);
  const cx = 32 + style.offset;
  const eyeY = 28 + (style.offset > 0 ? 1 : 0);
  const mouthY = 39 + (style.offset < 0 ? -1 : 0);
  const initials = name.trim().slice(0, 1).toUpperCase() || '?';

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
        <linearGradient id={`accent-${seed}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor={style.accent} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#bg-${seed})`} />

      {style.variant === 'blob' && (
        <path
          d="M17 27C17 19 24 14 32 14C42 14 49 21 49 31C49 42 42 50 31 50C22 50 15 43 15 34C15 32 16 29 17 27Z"
          fill={style.accent}
          fillOpacity="0.28"
        />
      )}
      {style.variant === 'orbit' && (
        <circle cx={cx} cy="32" r="14" fill={style.accent} fillOpacity="0.28" />
      )}
      {style.variant === 'stack' && (
        <>
          <rect x="16" y="18" width="32" height="18" rx="9" fill={style.accent} fillOpacity="0.26" />
          <rect x="20" y="34" width="24" height="12" rx="6" fill="#ffffff" fillOpacity="0.12" />
        </>
      )}
      {style.variant === 'badge' && (
        <circle cx="32" cy="31" r="13" fill="#ffffff" fillOpacity="0.12" />
      )}
      {style.variant === 'spark' && (
        <path
          d="M32 14L36 26L49 28L39 36L42 50L32 42L22 50L25 36L15 28L28 26Z"
          fill="#ffffff"
          fillOpacity="0.14"
        />
      )}
      {style.variant === 'helmet' && (
        <path
          d="M18 30C18 22 24 16 32 16C40 16 46 22 46 30V34H18V30Z"
          fill="#ffffff"
          fillOpacity="0.14"
        />
      )}

      <circle cx="24" cy={eyeY} r="2.5" fill="#0b1220" />
      <circle cx="40" cy={eyeY} r="2.5" fill="#0b1220" />
      <path
        d={`M26 ${mouthY}C29 ${mouthY + 2} 35 ${mouthY + 2} 38 ${mouthY}`}
        stroke="#0b1220"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      <circle cx="18" cy="20" r="3" fill="#ffffff" fillOpacity="0.85" />
      <circle cx="46" cy="18" r="2.2" fill="#ffffff" fillOpacity="0.65" />
      <circle cx="49" cy="43" r="1.8" fill="#ffffff" fillOpacity="0.55" />

      <text
        x="50%"
        y="56"
        textAnchor="middle"
        fontSize="10"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fill="#ffffff"
        fillOpacity="0.7"
      >
        {initials}
      </text>
    </svg>
  );
};
