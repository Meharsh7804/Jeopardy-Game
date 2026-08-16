import React from "react";
import { avatarFor } from "./avatarImages";

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
  const avatar = avatarFor(seed);

  if (!avatar) {
    const fallbackUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(
      seed
    )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50`;
    return (
      <img
        src={fallbackUrl}
        alt={`${name} avatar`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={className}
        loading="lazy"
      />
    );
  }

  return (
    <img
      src={avatar.src}
      alt={`${name} avatar`}
      width={size}
      height={size}
      style={{ width: size, height: size, objectPosition: avatar.position }}
      className={`object-cover rounded-full ${className}`}
      loading="lazy"
    />
  );
};