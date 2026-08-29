const avatars = import.meta.glob("../assets/avatars/*.{jpg,jpeg,png,webp,svg,gif}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

// Per-avatar object-position so the face stays visible inside the circular
// crop. Square images need no adjustment (nothing is cropped). Tall portraits
// are biased toward the top, where the head sits.
const POSITION_OVERRIDES: Record<string, string> = {
  john: "center top",
  virat: "center top",
};

const sorted = Object.entries(avatars).sort(([a], [b]) => a.localeCompare(b));

export interface AvatarOption {
  id: string;
  src: string;
  position: string;
}

export const avatarImages: AvatarOption[] = sorted.map(([path, src]) => {
  const file = path.split("/").pop()?.replace(/\.(jpg|jpeg|png|webp|svg|gif)$/i, "") ?? "";
  return { id: file, src, position: POSITION_OVERRIDES[file] ?? "center" };
});

// Deterministic string hash (FNV-1a) — a player keeps the same random avatar
// across reconnects and re-renders, but the pick is arbitrary per seed.
const hashSeed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const avatarFor = (seed: string): AvatarOption | undefined =>
  avatarImages.length === 0
    ? undefined
    : avatarImages[hashSeed(seed) % avatarImages.length];

export const getAvatarByIdOrSeed = (
  avatarIdOrSrc?: string,
  seed?: string
): AvatarOption | undefined => {
  if (avatarIdOrSrc) {
    const found = avatarImages.find(
      (a) => a.id === avatarIdOrSrc || a.src === avatarIdOrSrc
    );
    if (found) return found;
  }
  if (seed) return avatarFor(seed);
  return avatarImages[0];
};