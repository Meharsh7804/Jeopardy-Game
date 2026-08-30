import React from "react";
import { Sparkles, Lock } from "lucide-react";
import { getAbilityForAvatar } from "../../abilities/config";
import { CHARACTER_TRIVIA } from "../../abilities/trivia";
import { getAvatarByIdOrSeed } from "../../utils/avatarImages";

export interface CharacterCardProps {
  /** Selected avatar id (e.g. "kratos"). No selection renders a hint panel. */
  avatarId?: string;
  /** True when the selected avatar is already claimed by another player. */
  taken?: boolean;
  /** Compact mode for tight layouts (smaller avatar + shorter text). */
  compact?: boolean;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  avatarId,
  taken,
  compact,
}) => {
  const avatar = getAvatarByIdOrSeed(avatarId);
  const def = avatar ? getAbilityForAvatar(avatar.id) : undefined;

  if (!avatar || !def) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 flex flex-col justify-center gap-3 min-h-[12rem]">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-text-muted/40" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-display font-bold text-white/80">
              No character selected
            </p>
            <p className="text-[11px] text-text-muted/70 font-medium leading-relaxed">
              Pick a character to see their dossier — ability, style, and a
              trivia bite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const trivia = CHARACTER_TRIVIA[def.avatarId];

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 border space-y-3 overflow-hidden relative flex flex-col justify-between ${
        taken
          ? "border-danger-accent/40 bg-danger-accent/5"
          : "border-secondary-accent/25 bg-gradient-to-br from-secondary-accent/10 via-black/20 to-transparent"
      }`}
      style={{ minHeight: compact ? undefined : 280 }}
    >
      <div className="flex items-center gap-3">
        <img
          src={avatar.src}
          alt={def.name}
          className={`rounded-full object-cover shadow-lg ring-2 ring-secondary-accent/50 shrink-0 ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
          style={{ objectPosition: avatar.position }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display font-black text-white leading-tight">
            {def.name}
          </p>
          <p className="text-[11px] font-bold text-secondary-accent uppercase tracking-widest leading-snug">
            {def.emoji} {def.abilityName}
          </p>
        </div>
      </div>

      {taken && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-danger-accent flex items-center gap-1">
          <Lock className="w-3 h-3" /> Taken by another player in this room
        </p>
      )}

      {!compact && (
        <>
          <p className="text-xs text-text-muted italic leading-relaxed">
            {def.tagline}
          </p>
          <div className="h-px bg-white/10" />
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-accent">
              Ability details
            </p>
            <p className="text-xs text-white/90 leading-relaxed">
              {def.longDesc}
            </p>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-start gap-2">
            <Sparkles className="text-warning-accent w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-relaxed">
              <span className="font-bold text-warning-accent">
                Did you know?{" "}
              </span>
              {trivia}
            </p>
          </div>
        </>
      )}
    </div>
  );
};