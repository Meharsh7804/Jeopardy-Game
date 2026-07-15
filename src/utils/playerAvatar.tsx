import React from "react";

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
  // We use DiceBear's "avataaars" collection for high-quality, professional, and diverse human avatars.
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(
    seed
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50`;

  return (
    <img
      src={avatarUrl}
      alt={`${name} avatar`}
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
};
